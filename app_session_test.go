package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSessionPathSwapsExtensionSafely(t *testing.T) {
	cases := map[string]string{
		`F:\x\shot.png`:      `F:\x\shot.snipnote.json`,
		`F:\x\shot.jpeg`:     `F:\x\shot.snipnote.json`,
		`F:\dir.v2\noext`:    `F:\dir.v2\noext.snipnote.json`,
		`F:\dir.v2\shot.png`: `F:\dir.v2\shot.snipnote.json`,
	}
	for in, want := range cases {
		if got := sessionPathFor(in); got != want {
			t.Errorf("sessionPathFor(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSessionRoundTrip(t *testing.T) {
	dir := t.TempDir()
	img := filepath.Join(dir, "shot.png")
	app := &App{}

	state := `{"version":1,"annotations":[{"id":"a","type":"number","number":1}]}`
	if err := app.SaveSession(img, state); err != nil {
		t.Fatalf("save: %v", err)
	}
	got, err := app.LoadSession(img)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if got != state {
		t.Errorf("round trip mismatch:\n got %q\nwant %q", got, state)
	}
}

func TestSessionAbsentIsEmptyNotError(t *testing.T) {
	app := &App{}
	got, err := app.LoadSession(filepath.Join(t.TempDir(), "never-saved.png"))
	if err != nil {
		t.Fatalf("absence must not be an error, got %v", err)
	}
	if got != "" {
		t.Errorf("want empty string for absent session, got %q", got)
	}
}

func TestSaveSessionEmptyRemovesStaleFile(t *testing.T) {
	dir := t.TempDir()
	img := filepath.Join(dir, "shot.png")
	app := &App{}

	if err := app.SaveSession(img, `{"v":1}`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if err := app.SaveSession(img, ""); err != nil {
		t.Fatalf("empty save: %v", err)
	}
	if _, err := os.Stat(sessionPathFor(img)); !os.IsNotExist(err) {
		t.Error("empty save must remove the stale session file, or deleted notes resurrect on reopen")
	}
}
