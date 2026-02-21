#!/bin/bash
echo "Starting CodeVault backend (AgentVault)..."
cd "$(dirname "$0")/../../AgentVault"
python -m agentvault.cli.main serve --port 8420
