FROM nginx:alpine

# Copy the CloudDesk frontend files.
COPY index.html /usr/share/nginx/html/index.html
COPY style.css /usr/share/nginx/html/style.css
COPY script.js /usr/share/nginx/html/script.js

# Configure Nginx to proxy API requests to the backend.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80