package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSaveSidecarWritesContents(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "shot.md")

	app := &App{}
	if err := app.SaveSidecar(target, "# shot.png\n\n1. `wrong` - shadow\n"); err != nil {
		t.Fatalf("SaveSidecar returned error: %v", err)
	}

	got, err := os.ReadFile(target)
	if err != nil {
		t.Fatalf("sidecar not written: %v", err)
	}
	want := "# shot.png\n\n1. `wrong` - shadow\n"
	if string(got) != want {
		t.Errorf("contents mismatch\n got: %q\nwant: %q", got, want)
	}
}

func TestSaveSidecarSkipsEmpty(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "shot.md")

	app := &App{}
	if err := app.SaveSidecar(target, ""); err != nil {
		t.Fatalf("SaveSidecar returned error on empty: %v", err)
	}

	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Error("empty sidecar should not create a file")
	}
}
