#!/bin/bash
# Force clear all cached data

echo "Stopping PM2 dashboard..."
pm2 stop dashboard

echo "Waiting for shutdown..."
sleep 2

echo "Current state file:"
ls -la data/state.json 2>&1

echo ""
echo "Deleting state.json..."
rm -f data/state.json

echo "Verifying deletion..."
if [ -f data/state.json ]; then
    echo "ERROR: File still exists!"
    ls -la data/state.json
else
    echo "SUCCESS: state.json deleted"
fi

echo ""
echo "Starting PM2 dashboard..."
pm2 start dashboard

echo ""
echo "Waiting for startup..."
sleep 3

echo ""
echo "Recent logs:"
pm2 logs dashboard --lines 30 --nostream
