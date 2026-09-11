# Build Stage
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build for production
COPY . .
RUN npm run build

# Run Stage
FROM nginx:alpine
# Copy the compiled React assets to the Nginx HTML directory
COPY --from=build /app/dist /usr/share/nginx/html

# Replace the default Nginx config to support React Router (SPA fallback)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]