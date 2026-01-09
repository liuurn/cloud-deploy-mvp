#!/bin/sh
# Start Backend in background
echo "Starting Backend on 8081..."
java $JAVA_OPTS -jar /app/app.jar &

# Start Frontend
echo "Starting Frontend on port ${PORT:-3000}..."
# Use PORT environment variable if set, otherwise default to 3000
# npm run preview -- --port ${PORT:-3000} --host
cd /app/fe && npm install --registry https://registry.npmmirror.com/ && npm run dev -- --port ${PORT:-3000} --host &

# Start Nginx
echo "Starting Nginx on port 8080..."
nginx -g 'daemon off;'
