@echo off
setlocal enableextensions

pushd "%~dp0"

echo Iniciando API en una nueva ventana...
start "API Tendencia" cmd /c "pnpm --filter api dev"

timeout /t 2 >nul

echo Iniciando web preview en una nueva ventana...
start "WEB Tendencia" cmd /c "pnpm --filter web preview"

timeout /t 4 >nul
start "" "http://localhost:4173/"

echo.
echo Servidores iniciados. Abre http://localhost:4173/ en tu navegador.
echo Detenlos cerrando las ventanas de consola abiertas.
pause

popd
