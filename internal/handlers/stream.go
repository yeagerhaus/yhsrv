package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// StreamMusic handles serving music files for streaming
func StreamMusic(w http.ResponseWriter, r *http.Request) {
	// Extract the track ID (file path) from the URL
	trackID := strings.TrimPrefix(r.URL.Path, "/tracks/")
	filePath := filepath.Join("path/to/music/directory", trackID) // Modify with your actual directory

	file, err := os.Open(filePath)
	if err != nil {
		http.Error(w, fmt.Sprintf("could not open file: %v", err), http.StatusNotFound)
		return
	}
	defer file.Close()

	// Get file size and set the Content-Type based on file extension
	stat, err := file.Stat()
	if err != nil {
		http.Error(w, fmt.Sprintf("could not get file stats: %v", err), http.StatusInternalServerError)
		return
	}
	fileSize := stat.Size()

	ext := strings.ToLower(filepath.Ext(filePath))
	var contentType string
	switch ext {
	case ".mp3":
		contentType = "audio/mpeg"
	case ".m4a":
		contentType = "audio/mp4"
	case ".aac":
		contentType = "audio/aac"
	case ".ogg":
		contentType = "audio/ogg"
	case ".flac":
		contentType = "audio/flac"
	case ".wav":
		contentType = "audio/wav"
	default:
		contentType = "application/octet-stream"
	}

	// Handle Range Request (for efficient streaming)
	rangeHeader := r.Header.Get("Range")
	if rangeHeader != "" {
		// Parse the range header and set the appropriate response
		// (this is a simplified version; in a real-world app, you should handle byte ranges)
		http.ServeContent(w, r, filePath, stat.ModTime(), file)
		return
	}

	// No range request, serve the entire file
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", fileSize))
	_, err = io.Copy(w, file)
	if err != nil {
		http.Error(w, fmt.Sprintf("error while streaming file: %v", err), http.StatusInternalServerError)
	}
}
