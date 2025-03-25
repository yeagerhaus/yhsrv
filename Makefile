# Define the image name
IMAGE_NAME = go-server
CONTAINER_NAME = go-server-container
PORT = 8080

# Build the Docker image
build:
	docker build -t $(IMAGE_NAME) .

# Run the server container
srv-up: build
	docker run --rm -d --name $(CONTAINER_NAME) -p $(PORT):$(PORT) $(IMAGE_NAME)

# Stop and remove the running container
srv-down:
	docker stop $(CONTAINER_NAME)

# View container logs
logs:
	docker logs -f $(CONTAINER_NAME)

# Rebuild and restart the container
restart: srv-down srv-up

# Remove Docker image
clean:
	docker rmi -f $(IMAGE_NAME)

# Run using Docker Compose (if needed)
compose-up:
	docker-compose up --build -d

compose-down:
	docker-compose down
