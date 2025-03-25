# Use an official Go image as a builder stage
FROM golang:1.24.1-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy go.mod and go.sum to leverage Docker caching
COPY go.mod go.sum ./

# Download Go modules (dependencies)
RUN go mod download

# Copy the rest of the application source code
COPY . .

# Build the Go binary
RUN go build -o server main.go

# Use a minimal base image for the final container
FROM debian:stable-slim

# Set working directory in the container
WORKDIR /root/

# Copy the built binary from the builder stage
COPY --from=builder /app/server .

# Expose the application's port
EXPOSE 8080

# Set the entrypoint command
CMD ["./server"]
