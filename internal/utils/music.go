package utils

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"yhsrv/internal/models"

	"github.com/dhowden/tag"
)

// Track represents a music file
type Track struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Artist  string `json:"artist,omitempty"`
	Album   string `json:"album,omitempty"`
	Path    string `json:"path"`
	Format  string `json:"format"`
	Artwork string `json:"artwork,omitempty"`
}

// createTrackFromFile creates a Track object from a file, extracting metadata and artwork
func createTrackFromFile(filePath string) (models.Track, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return models.Track{}, err
	}
	defer file.Close()

	// Use the 'tag' library to read metadata (works for MP3, FLAC, etc.)
	metadata, err := tag.ReadFrom(file)
	if err != nil {
		return models.Track{}, err
	}

	// Build track information
	track := models.Track{
		ID:     filePath,
		Title:  metadata.Title(),
		Artist: metadata.Artist(),
		Album:  metadata.Album(),
		Format: strings.ToLower(filepath.Ext(filePath)),
	}

	// Check for embedded artwork in the metadata
	if picture := metadata.Picture(); picture != nil {
		// Encode the image as base64
		encoded := base64.StdEncoding.EncodeToString(picture.Data)
		// Add the base64-encoded artwork to the Track struct
		track.Artwork = "data:" + picture.MIMEType + ";base64," + encoded
	} else {
		// If no embedded artwork, look for artwork in the album directory
		coverArt := findAlbumArtwork(filepath.Dir(filePath))
		if coverArt != "" {
			// Construct the URL for the artwork (fallback to file path URL)
			track.Artwork = "/artwork/" + filepath.ToSlash(coverArt) // Convert to URL-friendly path
		}
	}

	return track, nil
}

// GetTracksFromDirectory scans the music directory and lists all audio files, pulling metadata
func GetTracksFromDirectory(musicDirectory string) ([]Track, error) {
	var tracks []Track

	err := filepath.Walk(musicDirectory, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return fmt.Errorf("error accessing %s: %w", path, err)
		}

		// Skip directories
		if info.IsDir() {
			return nil
		}

		// Check for valid audio file extensions
		ext := filepath.Ext(info.Name())
		validFormats := map[string]bool{
			".mp3": true, ".flac": true, ".wav": true, ".m4a": true, ".aac": true, ".ogg": true,
		}

		if validFormats[ext] {
			// Use createTrackFromFile to get metadata for each file
			track, err := createTrackFromFile(path)
			if err != nil {
				return fmt.Errorf("failed to read metadata for file %s: %w", path, err)
			}

			// Add track to the list
			tracks = append(tracks, Track{
				ID:      track.ID,
				Title:   track.Title,
				Artist:  track.Artist,
				Album:   track.Album,
				Path:    path,
				Format:  track.Format,
				Artwork: track.Artwork,
			})
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to scan music directory: %w", err)
	}

	return tracks, nil
}

// GetTracksFromAlbum reads all track files in an album folder and returns their metadata
func GetTracksFromAlbum(albumPath string) ([]models.Track, error) {
	var albumTracks []models.Track

	// Read the contents of the album folder
	entries, err := os.ReadDir(albumPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read album directory: %w", err)
	}

	// Loop through each file in the album folder
	for _, entry := range entries {
		if !entry.IsDir() {
			// We found a track file (skip directories)
			fileExtension := filepath.Ext(entry.Name())
			// You can add more file types as needed (flac, wav, etc.)
			if fileExtension == ".mp3" || fileExtension == ".flac" || fileExtension == ".wav" || fileExtension == ".mp4" {
				// Add track metadata (e.g., file name as track name)
				albumTracks = append(albumTracks, models.Track{
					ID:    entry.Name(),
					Title: entry.Name(), // You can extract more metadata here if needed
				})
			}
		}
	}

	return albumTracks, nil
}

// GetTrackByID returns a track by its ID (in this case, it's the file name)
func GetTrackByID(id string) (models.Track, error) {
	// This is a placeholder method to simulate getting a track by ID.
	// In practice, you could implement logic to retrieve the track from an index or database.
	return models.Track{ID: id, Title: id, Artist: "Unknown", Album: "Unknown", Format: "mp3", Artwork: "/path/to/art.jpg"}, nil
}

// findAlbumArtwork looks for cover.jpg or cover.png in the album directory
func findAlbumArtwork(dir string) string {
	for _, cover := range []string{"cover.jpg", "cover.png"} {
		artPath := filepath.Join(dir, cover)
		if _, err := os.Stat(artPath); err == nil {
			return artPath // Return the artwork path if found
		}
	}
	return ""
}
