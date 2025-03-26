package models

// Track represents an individual track with metadata
type Track struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Artist  string `json:"artist,omitempty"`
	Album   string `json:"album,omitempty"`
	Path    string `json:"path"`
	Format  string `json:"format"`
	Artwork string `json:"artwork,omitempty"`
}
