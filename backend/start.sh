#!/bin/bash

# HuloPredict Backend Startup Script
# Run this to start the server

cd "$(dirname "$0")"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the server
echo "Starting HuloPredict server..."
echo "API will be available at http://192.168.5.208:3000"
echo "Press Ctrl+C to stop"
echo ""

node server.js
