#!/bin/bash

# Diagnostic script: Check PDF files in database vs filesystem

echo "================================================================================"
echo "PDF ACCESS DIAGNOSTIC"
echo "================================================================================"
echo ""
echo "Checking uploads directory..."
echo ""

if [ -d /app/data/uploads ]; then
    echo "✓ /app/data/uploads exists"
    echo "Directory permissions:"
    ls -ld /app/data/uploads
    echo ""
    
    echo "Files in directory (first 20):"
    ls -lh /app/data/uploads | head -25
    echo ""
    
    echo "Total files: $(find /app/data/uploads -type f | wc -l)"
    echo "Total size: $(du -sh /app/data/uploads)"
else
    echo "✗ /app/data/uploads does not exist"
fi

echo ""
echo "================================================================================"
echo "Checking /tmp directory (old configuration)..."
echo ""
echo "Files in /tmp:"
ls -lh /tmp/*.pdf 2>/dev/null | head -10 || echo "No PDFs found in /tmp"

echo ""
echo "================================================================================"
echo "Environment variables:"
echo ""
echo "PDF_STORAGE_PATH: $PDF_STORAGE_PATH"
echo "DOCKER_ENV: Backend is running in Docker"

