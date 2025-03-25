package models

// Track represents an individual track with metadata
type Track struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Artist string `json:"artist"`
	Album  string `json:"album"`
	Format string `json:"format"`
	ArtURL string `json:"artUrl"` // URL for album artwork
}
