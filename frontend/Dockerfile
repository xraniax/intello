# Stage 1: Base - Setup and Dependency Installation
FROM node:20-alpine AS base
WORKDIR /app
ENV NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

COPY package*.json ./
RUN npm install

# Stage 2: Development - Dev server with HMR
FROM base AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# Stage 3: Build - Production bundle generation
FROM base AS build
COPY . .
RUN npm run build

# Stage 4: Production - Serving the static build
FROM node:20-alpine AS production
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
