package main

import (
	"image"
	"testing"
)

func TestExpandRectGrowsWithinBounds(t *testing.T) {
	bounds := image.Rect(0, 0, 1920, 1080)
	cur := image.Rect(500, 400, 900, 700)

	next, res := expandRect(cur, bounds, 50, 40, 30, 20)

	want := image.Rect(450, 360, 930, 720)
	if next != want {
		t.Fatalf("rect = %v, want %v", next, want)
	}
	if res.AppliedLeft != 50 || res.AppliedTop != 40 || res.AppliedRight != 30 || res.AppliedBottom != 20 {
		t.Errorf("applied = %d,%d,%d,%d want 50,40,30,20",
			res.AppliedLeft, res.AppliedTop, res.AppliedRight, res.AppliedBottom)
	}
	if !res.Expandable.Left || !res.Expandable.Top || !res.Expandable.Right || !res.Expandable.Bottom {
		t.Errorf("all edges should remain expandable, got %+v", res.Expandable)
	}
}

func TestExpandRectClampsAtScreenEdge(t *testing.T) {
	bounds := image.Rect(0, 0, 1920, 1080)
	cur := image.Rect(30, 20, 1900, 1070)

	next, res := expandRect(cur, bounds, 100, 100, 100, 100)

	if next != bounds {
		t.Fatalf("rect = %v, want full bounds %v", next, bounds)
	}
	// Applied deltas report what actually happened, not what was asked.
	if res.AppliedLeft != 30 || res.AppliedTop != 20 || res.AppliedRight != 20 || res.AppliedBottom != 10 {
		t.Errorf("applied = %d,%d,%d,%d want 30,20,20,10",
			res.AppliedLeft, res.AppliedTop, res.AppliedRight, res.AppliedBottom)
	}
	if res.Expandable.Left || res.Expandable.Top || res.Expandable.Right || res.Expandable.Bottom {
		t.Errorf("nothing should remain expandable at full bounds, got %+v", res.Expandable)
	}
}

func TestExpandRectNegativeDeltasAreZero(t *testing.T) {
	bounds := image.Rect(0, 0, 1000, 1000)
	cur := image.Rect(100, 100, 200, 200)

	next, res := expandRect(cur, bounds, -50, -50, -50, -50)

	if next != cur {
		t.Fatalf("negative deltas must not shrink: rect = %v, want %v", next, cur)
	}
	if res.AppliedLeft != 0 || res.AppliedTop != 0 || res.AppliedRight != 0 || res.AppliedBottom != 0 {
		t.Errorf("applied should be all zero, got %+v", res)
	}
}

func TestExpandRectMonitorWithNegativeOrigin(t *testing.T) {
	// A second monitor left of the primary puts the virtual screen origin at
	// negative X. The math is pure rectangle arithmetic, so this must hold.
	bounds := image.Rect(-1920, 0, 1920, 1080)
	cur := image.Rect(-100, 100, 300, 400)

	next, res := expandRect(cur, bounds, 200, 0, 0, 0)

	want := image.Rect(-300, 100, 300, 400)
	if next != want {
		t.Fatalf("rect = %v, want %v", next, want)
	}
	if res.AppliedLeft != 200 {
		t.Errorf("appliedLeft = %d, want 200", res.AppliedLeft)
	}
	if !res.Expandable.Left {
		t.Errorf("left edge at -300 of -1920 bounds should still be expandable")
	}
}

func TestExpandRegionWithoutBackingErrors(t *testing.T) {
	app := &App{}
	if _, err := app.ExpandRegion(10, 10, 10, 10); err == nil {
		t.Fatal("expected an error when no backing capture exists")
	}
}
