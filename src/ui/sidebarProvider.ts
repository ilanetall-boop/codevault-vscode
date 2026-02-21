/**
 * Webview provider for the sidebar panel.
 */

import * as vscode from 'vscode';
import { MemoryManager } from '../core/memoryManager';
import { Logger } from '../utils/logger';

export class SidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private extensionUri: vscode.Uri;
    private memoryManager: MemoryManager;

    constructor(extensionUri: vscode.Uri, memoryManager: MemoryManager) {
        this.extensionUri = extensionUri;
        this.memoryManager = memoryManager;
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };

        webviewView.webview.html = this.getHtml(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'search':
                    await this.handleSearch(message.query);
                    break;
                case 'export':
                    await vscode.commands.executeCommand('codevault.exportContext');
                    break;
                case 'refresh':
                    await this.refresh();
                    break;
            }
        });

        // Initial data load
        this.refresh();
    }

    /**
     * Refresh the webview content.
     */
    async refresh(): Promise<void> {
        if (!this._view) {return;}

        try {
            const stats = await this.memoryManager.getStats();
            const knowledge = this.memoryManager.getProjectKnowledge();
            const connected = this.memoryManager.isConnected;

            this._view.webview.postMessage({
                command: 'update',
                data: {
                    connected,
                    stats,
                    project: knowledge ? {
                        name: knowledge.name,
                        stack: [...knowledge.stack.languages, ...knowledge.stack.frameworks].join(', '),
                        analyzedAt: knowledge.analyzedAt,
                    } : null,
                },
            });
        } catch (error) {
            Logger.error('Failed to refresh sidebar:', error);
        }
    }

    /**
     * Handle search from webview.
     */
    private async handleSearch(query: string): Promise<void> {
        if (!this._view || !query) {return;}

        const result = await this.memoryManager.recall(query, { top_k: 10 });

        this._view.webview.postMessage({
            command: 'searchResults',
            data: {
                memories: result.memories,
                scores: result.relevance_scores,
                total: result.total_found,
                queryTime: result.query_time_ms,
            },
        });
    }

    /**
     * Generate HTML for webview.
     */
    private getHtml(_webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CodeVault</title>
    <style>
        :root {
            --semantic-color: #4CAF50;
            --episodic-color: #2196F3;
            --procedural-color: #FF9800;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background);
            padding: 10px;
            margin: 0;
        }

        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .header h2 {
            margin: 0;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .status {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .status-dot.connected { background: #4CAF50; }
        .status-dot.disconnected { background: #f44336; }

        .project-info {
            background: var(--vscode-editor-background);
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 15px;
        }

        .project-info h3 {
            margin: 0 0 5px 0;
            font-size: 12px;
            color: var(--vscode-textLink-foreground);
        }

        .project-info p {
            margin: 3px 0;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .search-box {
            display: flex;
            margin-bottom: 15px;
        }

        .search-box input {
            flex: 1;
            padding: 6px 10px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 3px;
            font-size: 12px;
        }

        .search-box input:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .memories-list {
            max-height: 400px;
            overflow-y: auto;
        }

        .memory-item {
            padding: 8px;
            margin-bottom: 8px;
            background: var(--vscode-editor-background);
            border-radius: 4px;
            border-left: 3px solid;
        }

        .memory-item.semantic { border-left-color: var(--semantic-color); }
        .memory-item.episodic { border-left-color: var(--episodic-color); }
        .memory-item.procedural { border-left-color: var(--procedural-color); }

        .memory-type {
            font-size: 10px;
            text-transform: uppercase;
            opacity: 0.7;
            margin-bottom: 3px;
        }

        .memory-content {
            font-size: 12px;
            line-height: 1.4;
            word-break: break-word;
        }

        .memory-meta {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }

        .actions {
            display: flex;
            gap: 8px;
            margin-top: 15px;
        }

        .btn {
            flex: 1;
            padding: 6px 12px;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .empty-state {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>🧠 CodeVault</h2>
        <div class="status">
            <span class="status-dot disconnected" id="statusDot"></span>
            <span id="statusText">Connecting...</span>
        </div>
    </div>

    <div class="project-info" id="projectInfo" style="display: none;">
        <h3 id="projectName">Project</h3>
        <p id="projectStack">Stack: Unknown</p>
        <p id="projectAnalyzed">Last analyzed: Never</p>
    </div>

    <div class="search-box">
        <input type="text" id="searchInput" placeholder="Search memories..." />
    </div>

    <div class="memories-list" id="memoriesList">
        <div class="empty-state">
            <p>No memories yet.</p>
            <p>Select code and press Ctrl+Shift+R to remember.</p>
        </div>
    </div>

    <div class="actions">
        <button class="btn" onclick="exportContext()">📤 Export Context</button>
        <button class="btn btn-secondary" onclick="refresh()">🔄 Refresh</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Search handling
        const searchInput = document.getElementById('searchInput');
        let searchTimeout;

        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                vscode.postMessage({ command: 'search', query: e.target.value });
            }, 300);
        });

        // Message handling
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.command) {
                case 'update':
                    updateStatus(message.data);
                    break;
                case 'searchResults':
                    showSearchResults(message.data);
                    break;
            }
        });

        function updateStatus(data) {
            const dot = document.getElementById('statusDot');
            const text = document.getElementById('statusText');

            if (data.connected) {
                dot.className = 'status-dot connected';
                text.textContent = data.stats ? \`\${data.stats.total} memories\` : 'Connected';
            } else {
                dot.className = 'status-dot disconnected';
                text.textContent = 'Disconnected';
            }

            if (data.project) {
                const info = document.getElementById('projectInfo');
                info.style.display = 'block';
                document.getElementById('projectName').textContent = data.project.name;
                document.getElementById('projectStack').textContent = 'Stack: ' + data.project.stack;
                document.getElementById('projectAnalyzed').textContent =
                    'Analyzed: ' + new Date(data.project.analyzedAt).toLocaleString();
            }
        }

        function showSearchResults(data) {
            const list = document.getElementById('memoriesList');

            if (!data.memories || data.memories.length === 0) {
                list.innerHTML = '<div class="empty-state">No memories found</div>';
                return;
            }

            list.innerHTML = data.memories.map((mem, i) => \`
                <div class="memory-item \${mem.type}">
                    <div class="memory-type">\${mem.type}</div>
                    <div class="memory-content">\${escapeHtml(mem.content.substring(0, 150))}</div>
                    <div class="memory-meta">
                        Score: \${data.scores[i].toFixed(2)} | \${timeAgo(new Date(mem.created_at))}
                    </div>
                </div>
            \`).join('');
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function timeAgo(date) {
            const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
            if (seconds < 60) return 'just now';
            if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
            if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
            return Math.floor(seconds / 86400) + 'd ago';
        }

        function exportContext() {
            vscode.postMessage({ command: 'export' });
        }

        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }
    </script>
</body>
</html>`;
    }
}
