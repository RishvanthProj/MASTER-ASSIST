#!/bin/bash
# Startup script for Master Assist Local POS System
# This script starts the backend server which now also serves the frontend UI.

# 1. Kill any existing server on port 4000
lsof -ti:4000 | xargs kill -9 2>/dev/null

echo "Starting Master Assist Local Server..."
cd "$(dirname "$0")/server"

# Start the Node server
node server.js &
SERVER_PID=$!

echo "Server started with PID: $SERVER_PID"

# Wait a second for the server to bind and check database access
sleep 2

# Check if the server is still running (it will exit if the DB is locked)
if ! kill -0 $SERVER_PID 2>/dev/null; then
  echo ""
  echo "❌ SERVER FAILED TO START!"
  echo "Please check the error messages above."
  echo "Press any key to exit..."
  read -n 1
  exit 1
fi

# Open the app in the default browser
echo "Opening POS application..."
if which xdg-open > /dev/null; then
  xdg-open "http://localhost:4000/index.html"
elif which gnome-open > /dev/null; then
  gnome-open "http://localhost:4000/index.html"
elif which open > /dev/null; then
  open "http://localhost:4000/index.html"
fi

echo "Master Assist is running. Keep this terminal open."
echo "Press Ctrl+C to stop the server and exit."

wait $SERVER_PID
