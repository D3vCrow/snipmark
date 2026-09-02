package main

import (
	"bytes"
	"encoding/base64"
	"errors"
	"image"
	"image/png"
)

// The backing capture: when a region is snipped, the full virtual screen that
// was photographed for the selection overlay is kept here instead of thrown
// away. Expanding the snip is then a re-crop of this image - no second
// capture, and the pixels around the snip are from the same instant as the
// snip itself.
//
// Held in Go memory only (a 1080p screen is ~8 MB RGBA); the frontend never
// receives the full image. Cleared by the next capture of any kind.

// Expandable reports which edges still have hidden pixels behind them.
type Expandable struct {
	Left   bool `json:"left"`
	Top    bool `json:"top"`
	Right  bool `json:"right"`
	Bottom bool `json:"bottom"`
}

// ExpandResult is what the frontend gets back from ExpandRegion: the new
// cropped image plus how far each edge actually moved (requests are clamped
// to the screen bounds, so applied deltas can be smaller than asked).
// AppliedLeft/AppliedTop are what existing annotations must shift by.
type ExpandResult struct {
	Width         int        `json:"width"`
	Height        int        `json:"height"`
	Data          string     `json:"data"`
	AppliedLeft   int        `json:"appliedLeft"`
	AppliedTop    int        `json:"appliedTop"`
	AppliedRight  int        `json:"appliedRight"`
	AppliedBottom int        `json:"appliedBottom"`
	Expandable    Expandable `json:"expandable"`
}

// expandRect grows cur by the requested per-edge deltas, clamped to bounds.
// Pure function so the clamping arithmetic is unit-testable without a screen.
func expandRect(cur, bounds image.Rectangle, dl, dt, dr, db int) (image.Rectangle, ExpandResult) {
	if dl < 0 {
		dl = 0
	}
	if dt < 0 {
		dt = 0
	}
	if dr < 0 {
		dr = 0
	}
	if db < 0 {
		db = 0
	}

	next := image.Rect(cur.Min.X-dl, cur.Min.Y-dt, cur.Max.X+dr, cur.Max.Y+db)
	next = next.Intersect(bounds)

	res := ExpandResult{
		AppliedLeft:   cur.Min.X - next.Min.X,
		AppliedTop:    cur.Min.Y - next.Min.Y,
		AppliedRight:  next.Max.X - cur.Max.X,
		AppliedBottom: next.Max.Y - cur.Max.Y,
		Expandable:    expandableFrom(next, bounds),
		Width:         next.Dx(),
		Height:        next.Dy(),
	}
	return next, res
}

func expandableFrom(cur, bounds image.Rectangle) Expandable {
	return Expandable{
		Left:   cur.Min.X > bounds.Min.X,
		Top:    cur.Min.Y > bounds.Min.Y,
		Right:  cur.Max.X < bounds.Max.X,
		Bottom: cur.Max.Y < bounds.Max.Y,
	}
}

// setBacking stores the full-screen image a region was cut from, plus the cut
// rect, both in the image's own (physical pixel) coordinate space.
func (a *App) setBacking(img *image.RGBA, rect image.Rectangle) {
	a.backingMu.Lock()
	defer a.backingMu.Unlock()
	a.backingImg = img
	a.backingRect = rect
}

// clearBacking drops the stored screen. Called on every non-region capture
// and when an image is opened from the library: there is nothing truthful to
// reveal around those.
func (a *App) clearBacking() {
	a.backingMu.Lock()
	defer a.backingMu.Unlock()
	a.backingImg = nil
	a.backingRect = image.Rectangle{}
}

// backingExpandable reports which edges of the current backing rect can still
// grow. Zero-value (all false) when no backing exists.
func (a *App) backingExpandable() Expandable {
	a.backingMu.Lock()
	defer a.backingMu.Unlock()
	if a.backingImg == nil {
		return Expandable{}
	}
	return expandableFrom(a.backingRect, a.backingImg.Bounds())
}

// ExpandRegion re-crops the backing screen with each edge grown by the given
// amounts (physical pixels, negatives treated as zero) and returns the new
// image. The frontend shifts existing annotations by AppliedLeft/AppliedTop.
func (a *App) ExpandRegion(left, top, right, bottom int) (*ExpandResult, error) {
	a.backingMu.Lock()
	defer a.backingMu.Unlock()

	if a.backingImg == nil {
		return nil, errors.New("no backing capture to expand - only region snips keep one")
	}

	next, res := expandRect(a.backingRect, a.backingImg.Bounds(), left, top, right, bottom)
	if next == a.backingRect {
		// Nothing moved (already at the screen edge); saves a re-encode.
		res.Width = next.Dx()
		res.Height = next.Dy()
		return &res, nil
	}

	cropped := a.backingImg.SubImage(next)
	var buf bytes.Buffer
	if err := png.Encode(&buf, cropped); err != nil {
		return nil, err
	}

	a.backingRect = next
	res.Data = base64.StdEncoding.EncodeToString(buf.Bytes())
	return &res, nil
}
