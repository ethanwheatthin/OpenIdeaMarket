@echo off
echo === IdeaMarket Multi-Agent Spawner ===
echo.

set /p OLLAMA_URL="Ollama URL [http://localhost:11434]: "
if "%OLLAMA_URL%"=="" set OLLAMA_URL=http://localhost:11434

set /p OLLAMA_MODEL="Model name [llama3.2]: "
if "%OLLAMA_MODEL%"=="" set OLLAMA_MODEL=llama3.2

echo.
echo Starting agents with:
echo   OLLAMA_URL   = %OLLAMA_URL%
echo   OLLAMA_MODEL = %OLLAMA_MODEL%
echo.

set OLLAMA_URL=%OLLAMA_URL%
set OLLAMA_MODEL=%OLLAMA_MODEL%
node_modules\.bin\tsx.cmd spawn-agents.ts
