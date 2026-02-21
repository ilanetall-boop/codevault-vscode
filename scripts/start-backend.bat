@echo off
echo Starting CodeVault backend (AgentVault)...
cd /d "%~dp0..\..\AgentVault"
python -m agentvault.cli.main serve --port 8420
