package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"
	"time"

	"yhsrv/internal/handlers"

	"go.oneofone.dev/gserv"
)

func main() {
	// Graceful shutdown setup
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT, syscall.SIGQUIT)
	defer stop()

	// Set up gserv server
	server := gserv.New(gserv.WriteTimeout(time.Second*30), gserv.ReadTimeout(time.Second*30))

	// Serve the dynamic tracks and streaming endpoints
	server.GET("/ping", handlers.Ping)
	server.GET("/tracks", handlers.GetTracks)
	server.GET("/track/{id}", handlers.GetTrack)
	server.GET("/stream/{id}", handlers.StreamTrack)

	// Start server
	port := ":8080"
	log.Printf("Starting server on %s\n", port)
	go func() {
		if err := server.Run(ctx, port); err != nil {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Wait for shutdown signal
	<-ctx.Done()
	log.Println("Shutting down server...")
	server.Close()
}
