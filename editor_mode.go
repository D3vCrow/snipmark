package main

import (
	"encoding/base64"
	"fmt"
	"image"
	"image/png"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"winshot/internal/screenshot"
)

// Per-snip editor windows (Chris's ruling, 2026-09-02: "per snip").
//
// Wails v2 gives one native window per process, so "each snip opens its own
// editor window" means each snip spawns a fresh winshot.exe in editor mode.
// The main instance keeps the tray, the hotkeys and the capture overlay; an
// editor instance is just the image and the tools around it. Several editor
// windows can be open at once - that is the "series of notes" requirement
// getting real windows instead of a list.
//
// Handoff between the processes is files, not IPC: the snip is saved to the
// normal save folder immediately (so nothing is ever lost even if the editor
// crashes), and the backing screen - the full-screen capture a region snip
// was cut from - rides along as a temp PNG that the editor loads into its own
// memory and deletes. That keeps reveal working inside the editor window,
// process boundary or not.

// LaunchInfo tells the frontend which kind of process it woke up in.
type LaunchInfo struct {
	EditorMode bool        `json:"editorMode"`
	ImagePath  string      `json:"imagePath"`
	Expandable *Expandable `json:"expandable"` // nil when no backing rode along
}

// editorLaunch is what main() parses off the command line.
type editorLaunch struct {
	imagePath   string
	backingPath string
	backingRect image.Rectangle
	hasBacking  bool
}

// parseEditorArgs recognises: --edit <image> [--backing <png> --backing-rect x,y,w,h]
// Returns nil for a normal (main-instance) launch.
func parseEditorArgs(args []string) *editorLaunch {
	var launch *editorLaunch
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--edit":
			if i+1 < len(args) {
				launch = &editorLaunch{imagePath: args[i+1]}
				i++
			}
		case "--backing":
			if launch != nil && i+1 < len(args) {
				launch.backingPath = args[i+1]
				i++
			}
		case "--backing-rect":
			if launch != nil && i+1 < len(args) {
				var x, y, w, h int
				if n, _ := fmt.Sscanf(args[i+1], "%d,%d,%d,%d", &x, &y, &w, &h); n == 4 {
					launch.backingRect = image.Rect(x, y, x+w, y+h)
					launch.hasBacking = true
				}
				i++
			}
		}
	}
	return launch
}

// GetLaunchInfo lets the frontend ask which mode it is in, once, on mount.
func (a *App) GetLaunchInfo() LaunchInfo {
	info := LaunchInfo{EditorMode: a.editMode, ImagePath: a.editPath}
	if a.editMode {
		if e := a.backingExpandable(); e.Left || e.Top || e.Right || e.Bottom {
			info.Expandable = &e
		}
	}
	return info
}

// loadBackingFromTemp reads the backing PNG an editor instance was handed,
// installs it as this process's backing capture, and deletes the temp file -
// it is meaningless to any other process and only clutter after this.
func (a *App) loadBackingFromTemp(path string, rect image.Rectangle) {
	f, err := os.Open(path)
	if err != nil {
		log.Printf("backing: cannot open %q: %v (reveal disabled for this window)", path, err)
		return
	}
	img, err := png.Decode(f)
	f.Close()
	os.Remove(path)
	if err != nil {
		log.Printf("backing: cannot decode %q: %v (reveal disabled for this window)", path, err)
		return
	}
	rgba, ok := img.(*image.RGBA)
	if !ok {
		// png.Decode may hand back NRGBA or others; normalise once.
		b := img.Bounds()
		rgba = image.NewRGBA(b)
		for y := b.Min.Y; y < b.Max.Y; y++ {
			for x := b.Min.X; x < b.Max.X; x++ {
				rgba.Set(x, y, img.At(x, y))
			}
		}
	}
	a.setBacking(rgba, rect)
	log.Printf("backing: loaded %dx%d, snip rect %v", rgba.Bounds().Dx(), rgba.Bounds().Dy(), rect)
}

// saveCaptureToDisk writes freshly captured PNG bytes straight into the save
// folder with a timestamped name. Capture-time save is deliberate: the snip
// exists on disk before its editor window even opens, so a crashed or closed
// editor loses annotations at worst, never the capture itself.
func (a *App) saveCaptureToDisk(pngBytes []byte) (string, error) {
	saveDir := a.config.QuickSave.Folder
	if saveDir == "" {
		saveDir = defaultSaveDir
	}
	if err := os.MkdirAll(saveDir, 0755); err != nil {
		return "", err
	}
	base := "winshot_" + time.Now().Format("2006-01-02_15-04-05")
	path := filepath.Join(saveDir, base+".png")
	for counter := 1; ; counter++ {
		if _, err := os.Stat(path); os.IsNotExist(err) {
			break
		}
		path = filepath.Join(saveDir, fmt.Sprintf("%s_%d.png", base, counter))
	}
	if err := os.WriteFile(path, pngBytes, 0644); err != nil {
		return "", err
	}
	return path, nil
}

// spawnEditor opens a new editor-window process for an image already on disk.
// backing may be nil; when present it is written to a temp PNG the child
// loads and deletes. Spawn failures are logged, never fatal - the image is
// saved either way, reachable from the library.
func (a *App) spawnEditor(imagePath string, backing *image.RGBA, rect image.Rectangle) {
	exe, err := os.Executable()
	if err != nil {
		log.Printf("editor spawn: cannot resolve own executable: %v", err)
		return
	}
	args := []string{"--edit", imagePath}
	if backing != nil {
		tmp := filepath.Join(os.TempDir(),
			fmt.Sprintf("snipmark-backing-%d-%d.png", os.Getpid(), time.Now().UnixNano()))
		f, err := os.Create(tmp)
		if err == nil {
			err = png.Encode(f, backing)
			f.Close()
		}
		if err != nil {
			log.Printf("editor spawn: backing temp write failed: %v (window opens without reveal)", err)
		} else {
			args = append(args, "--backing", tmp,
				"--backing-rect", fmt.Sprintf("%d,%d,%d,%d", rect.Min.X, rect.Min.Y, rect.Dx(), rect.Dy()))
		}
	}
	cmd := exec.Command(exe, args...)
	if err := cmd.Start(); err != nil {
		log.Printf("editor spawn: %v (open the image from the library instead)", err)
		return
	}
	log.Printf("editor window spawned for %s (pid %d)", filepath.Base(imagePath), cmd.Process.Pid)
}

// CaptureFullscreenToEditor captures the whole screen, saves it, and opens it
// in its own editor window - the per-snip flow for the fullscreen button and
// hotkey. No backing: a fullscreen shot has nothing hidden around it.
func (a *App) CaptureFullscreenToEditor() error {
	a.clearBacking()
	result, err := screenshot.CaptureFullscreen()
	if err != nil {
		return err
	}
	pngBytes, err := base64.StdEncoding.DecodeString(result.Data)
	if err != nil {
		return err
	}
	path, err := a.saveCaptureToDisk(pngBytes)
	if err != nil {
		return err
	}
	a.spawnEditor(path, nil, image.Rectangle{})
	return nil
}

// SaveImageToPath overwrites a specific file with new image data - the editor
// window's Ctrl+S, which re-saves its own image in place instead of minting a
// new timestamped file the way the main window's quick-save does.
func (a *App) SaveImageToPath(path string, imageData string) SaveImageResult {
	data, err := base64.StdEncoding.DecodeString(imageData)
	if err != nil {
		return SaveImageResult{Success: false, Error: "Invalid image data: " + err.Error()}
	}
	// Same containment rule as DeleteScreenshot: an editor window only ever
	// rewrites files inside the save folder it was handed images from.
	folder := a.config.QuickSave.Folder
	if folder == "" {
		folder = defaultSaveDir
	}
	absPath, err1 := filepath.Abs(path)
	absFolder, err2 := filepath.Abs(folder)
	if err1 != nil || err2 != nil ||
		!strings.HasPrefix(absPath, absFolder+string(filepath.Separator)) {
		return SaveImageResult{Success: false, Error: "Refusing to write outside the save folder"}
	}
	if err := os.WriteFile(absPath, data, 0644); err != nil {
		return SaveImageResult{Success: false, Error: err.Error()}
	}
	return SaveImageResult{Success: true, FilePath: absPath}
}
