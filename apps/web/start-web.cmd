@echo off
setlocal
pushd "%~dp0"
start "" "http://localhost:5173/"
pnpm --filter web run dev
popd
pause