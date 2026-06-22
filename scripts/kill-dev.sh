#!/bin/bash
# Kill any processes left over from a previous dev session.
# Safe to run any time — ports might already be clear.
lsof -ti :3000 | xargs kill -9 2>/dev/null && echo "killed :3000" || true
lsof -ti :5173 | xargs kill -9 2>/dev/null && echo "killed :5173" || true
pkill -f "tsx watch" 2>/dev/null && echo "killed tsx watch" || true
