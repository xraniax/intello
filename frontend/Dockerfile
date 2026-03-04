# Use an official Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
# We copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./
RUN npm install

# Copy all frontend source files
COPY . .

# Build the React app
# Note: For Vite projects, the build output is in the 'dist' folder
RUN npm run build

# Install 'serve' package to serve the static build
RUN npm install -g serve

# Expose port 3000
EXPOSE 3000

# Start the frontend in production mode
# We use -s for single-page app routing and -l to specify the port
CMD ["serve", "-s", "dist", "-l", "3000"]
