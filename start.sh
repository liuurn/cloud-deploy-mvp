#!/bin/sh

# Start Backend in background
echo "Starting Backend..."
java $JAVA_OPTS -jar /app/app.jar &

# Start Frontend
echo "Starting Frontend on port ${PORT:-3000}..."
# Use PORT environment variable if set, otherwise default to 3000
# npm run preview -- --port ${PORT:-3000} --host
cd /app/fe && npm run preview -- --port ${PORT:-3000} --host uxoqnyiht2q3.app.jcloudcs.com