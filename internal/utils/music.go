package utils

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"yhsrv/internal/models"

	"github.com/dhowden/tag"
)

// GetTracksFromDirectory reads all files in the music directory and extracts track metadata
func GetTracksFromDirectory(musicDirectory string) ([]models.Track, error) {
	var tracks []models.Track

	// Read the contents of the music directory
	entries, err := os.ReadDir(musicDirectory)
	if err != nil {
		return nil, fmt.Errorf("failed to read music directory: %w", err)
	}

	// Loop through each entry (album or track) in the directory
	for _, entry := range entries {
		if entry.IsDir() {
			// Handle albums (directories)
			albumPath := fmt.Sprintf("%s/%s", musicDirectory, entry.Name())
			albumTracks, err := GetTracksFromAlbum(albumPath)
			if err != nil {
				log.Printf("Failed to fetch tracks for album %s: %v", entry.Name(), err)
				continue
			}

			tracks = append(tracks, albumTracks...)
		}
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
					ID:   entry.Name(),
					Name: entry.Name(), // You can extract more metadata here if needed
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
	return models.Track{ID: id, Name: id, Artist: "Unknown", Album: "Unknown", Format: "mp3", ArtURL: "/path/to/art.jpg"}, nil
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
		Name:   metadata.Title(),
		Artist: metadata.Artist(),
		Album:  metadata.Album(),
		Format: strings.ToLower(filepath.Ext(filePath)),
	}

	// Look for artwork (cover.jpg or cover.png) in the same folder
	coverArt := findAlbumArtwork(filepath.Dir(filePath))
	if coverArt != "" {
		track.ArtURL = coverArt
	}

	return track, nil
}

// isAudioFile checks if a file is an audio file based on its extension
func isAudioFile(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".mp3", ".flac", ".wav", ".mp4", ".aac":
		return true
	default:
		return false
	}
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
