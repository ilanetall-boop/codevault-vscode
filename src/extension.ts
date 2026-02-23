/**
 * CodeVault - Persistent Memory for AI Coding Agents
 *
 * This is the main entry point for the VS Code extension.
 */

import * as vscode from 'vscode';
import { MemoryClient } from './core/memoryClient';
import { MemoryManager } from './core/memoryManager';
import { ProjectAnalyzer } from './core/projectAnalyzer';
import { AutoCapture } from './capture/autoCapture';
import { MemoryTreeProvider } from './ui/memoryTreeProvider';
import { SidebarProvider } from './ui/sidebarProvider';
import { StatusBarManager } from './ui/statusBar';
import { registerCommands } from './commands';
import { Logger } from './utils/logger';
import { getConfig } from './utils/config';

let memoryClient: MemoryClient;
let memoryManager: MemoryManager;
let autoCapture: AutoCapture;
let statusBar: StatusBarManager;

export async function activate(context: vscode.ExtensionContext) {
    // Initialize logger
    Logger.init(context);
    Logger.info('CodeVault activating...');

    // Get configuration
    const config = getConfig();
    const wsConfig = vscode.workspace.getConfiguration('codevault');

    // Initialize core components
    memoryClient = new MemoryClient(config.backendUrl);
    const client = memoryClient;
    const analyzer = new ProjectAnalyzer();
    memoryManager = new MemoryManager(client, wsConfig);

    // Check backend connection
    const connected = await client.healthCheck();
    if (!connected) {
        const choice = await vscode.window.showWarningMessage(
            'CodeVault: Backend not running. Memory features will be limited.',
            'Start Backend',
            'Ignore'
        );

        if (choice === 'Start Backend') {
            vscode.commands.executeCommand('codevault.startBackend');
        }
    } else {
        Logger.info('Connected to CodeVault backend');
    }

    // Initialize UI components
    const treeProvider = new MemoryTreeProvider(memoryManager);
    const sidebarProvider = new SidebarProvider(context.extensionUri, memoryManager);
    statusBar = new StatusBarManager(memoryManager);

    // Register tree view
    const treeView = vscode.window.createTreeView('codevault-memories', {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    // Register webview provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('codevault-project', sidebarProvider)
    );

    // Register commands
    registerCommands(context, memoryManager, analyzer, treeProvider);

    // Start auto-capture if enabled
    if (config.autoCapture) {
        autoCapture = new AutoCapture(memoryManager, analyzer);
        autoCapture.start(context);
        Logger.info('Auto-capture enabled');
    }

    // Show status bar
    statusBar.show();
    context.subscriptions.push(statusBar);

    // Analyze project on startup (if workspace is open)
    if (vscode.workspace.workspaceFolders && connected) {
        // Delay analysis to not slow down activation
        setTimeout(async () => {
            try {
                const knowledge = await analyzer.analyzeWorkspace();
                await memoryManager.storeProjectKnowledge(knowledge);
                treeProvider.refresh();
                Logger.info('Project analyzed on startup');
            } catch (error) {
                Logger.warn('Failed to analyze project on startup:', error);
            }
        }, 2000);
    }

    // Register memory detail command
    context.subscriptions.push(
        vscode.commands.registerCommand('codevault.showMemoryDetail', (memory) => {
            const panel = vscode.window.createWebviewPanel(
                'memoryDetail',
                'Memory Detail',
                vscode.ViewColumn.Beside,
                { enableScripts: false }
            );

            panel.webview.html = `<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        .type {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 11px;
            text-transform: uppercase;
            margin-bottom: 10px;
        }
        .type.semantic { background: #4CAF50; color: white; }
        .type.episodic { background: #2196F3; color: white; }
        .type.procedural { background: #FF9800; color: white; }
        .content {
            background: var(--vscode-textBlockQuote-background);
            padding: 15px;
            border-radius: 5px;
            white-space: pre-wrap;
            margin: 15px 0;
        }
        .meta {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
        .tags {
            margin-top: 10px;
        }
        .tag {
            display: inline-block;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            margin-right: 5px;
        }
    </style>
</head>
<body>
    <span class="type ${memory.type}">${memory.type}</span>
    <div class="content">${escapeHtml(memory.content)}</div>
    <div class="meta">
        <p><strong>Importance:</strong> ${memory.importance.toFixed(2)}</p>
        <p><strong>Created:</strong> ${new Date(memory.created_at).toLocaleString()}</p>
        <p><strong>Access Count:</strong> ${memory.access_count}</p>
        ${memory.source ? `<p><strong>Source:</strong> ${memory.source}</p>` : ''}
    </div>
    ${memory.tags.length > 0 ? `
    <div class="tags">
        <strong>Tags:</strong>
        ${memory.tags.map((t: string) => `<span class="tag">${t}</span>`).join('')}
    </div>
    ` : ''}
</body>
</html>`;

            function escapeHtml(text: string): string {
                return text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            }
        })
    );

    Logger.info('CodeVault activated successfully');
}

export function deactivate() {
    if (autoCapture) {
        autoCapture.stop();
    }
    if (memoryClient) {
        memoryClient.dispose();
    }
    if (statusBar) {
        statusBar.dispose();
    }
    Logger.info('CodeVault deactivated');
}
