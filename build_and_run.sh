#!/bin/bash

# Build React frontend
echo "Building React frontend..."
cd frontend
npm install
npm run build
cd ..

# Start FastAPI backend
echo "Starting FastAPI backend..."
python3 app.py
