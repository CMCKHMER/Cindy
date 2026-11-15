@echo off
title Sasha Maid
cd /d "%~dp0"
echo.
echo   SASHA MAID - your desktop, tidied.
echo   First run installs everything; later runs just open the app.
echo.
where py >nul 2>nul
if %errorlevel%==0 (set "PYCMD=py -3") else (set "PYCMD=python")
%PYCMD% scripts\desktop_setup.py %*
if errorlevel 1 (
  echo.
  echo   Setup stopped. If Python is missing, install it from python.org and tick
  echo   "Add python.exe to PATH", then double-click this file again.
  echo.
  pause
)