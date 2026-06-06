@echo off
title Biblioteca Expandida
cd /d "%~dp0"

if not exist .env (
  echo.
  echo  AVISO: O arquivo .env nao existe.
  echo  Copie o arquivo .env.example para .env
  echo  e preencha sua chave ANTHROPIC_API_KEY.
  echo.
  pause
  exit /b
)

if not exist node_modules (
  echo  Instalando dependencias pela primeira vez...
  call npm install
  echo.
)

echo  Iniciando Biblioteca Expandida...
start "" http://localhost:3000
node server.js
pause
