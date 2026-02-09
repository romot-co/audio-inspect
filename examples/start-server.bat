@echo off
setlocal

set PORT=%1
if "%PORT%"=="" set PORT=8080

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required to run this demo server.
  echo Install Node.js and rerun this script.
  exit /b 1
)

node "%~dp0serve-demo.mjs" %PORT%
