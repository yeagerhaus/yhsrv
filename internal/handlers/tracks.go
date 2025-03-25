package handlers

import (
	"net/http"
	"path/filepath"

	"yhsrv/internal/utils"

	"go.oneofone.dev/gserv"
)

// GetTracks handles GET /tracks
func GetTracks(ctx *gserv.Context) gserv.Response {
	tracks, err := utils.GetTracksFromDirectory("./music")
	if err != nil {
		return gserv.NewJSONErrorResponse(http.StatusInternalServerError, "Failed to fetch tracks")
	}
	return gserv.NewJSONResponse(tracks)
}

// GetTrack handles GET /track/{id}
func GetTrack(ctx *gserv.Context) gserv.Response {
	id := ctx.Param("id")
	track, err := utils.GetTrackByID(id)
	if err != nil {
		return gserv.NewJSONErrorResponse(http.StatusNotFound, "Track not found")
	}
	return gserv.NewJSONResponse(track)
}

// StreamTrack handles GET /stream/{id}
func StreamTrack(ctx *gserv.Context) gserv.Response {
	id := ctx.Param("id")
	track, err := utils.GetTrackByID(id)
	if err != nil {
		return gserv.NewJSONErrorResponse(http.StatusNotFound, "Track not found")
	}

	// Serve the audio file dynamically
	filePath := filepath.Join("./music", track.Album, track.Name)
	return gserv.NewJSONResponse(filePath)
}

// Ping for health check
func Ping(ctx *gserv.Context) gserv.Response {
	return gserv.NewJSONResponse(map[string]string{"message": "pong"})
}
