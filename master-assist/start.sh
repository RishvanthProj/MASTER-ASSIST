#!/bin/bash
# Startup script for Master Assist Local POS System
# This script starts the backend server and opens the frontend in the default browser.

# 1. Kill any existing server on port 4000
lsof -ti:4000 | xargs kill -9 2>/dev/null

echo "Starting Master Assist Local Server..."
cd "$(dirname "$0")/server"
node server.js &
SERVER_PID=$!

echo "Server started with PID: $SERVER_PID"

# Wait a second for the server to bind
sleep 2

# Open the frontend in the default browser
echo "Opening POS application..."
cd ..
if which xdg-open > /dev/null; then
  xdg-open "file://$(pwd)/index.html"
elif which gnome-open > /dev/null; then
  gnome-open "file://$(pwd)/index.html"
elif which open > /dev/null; then
  open "file://$(pwd)/index.html"
fi

echo "Master Assist is running. Keep this terminal open."
echo "Press Ctrl+C to stop the server and exit."

wait $SERVER_PID
