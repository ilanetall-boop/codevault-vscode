/**
 * Watches for file changes and captures important ones.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { MemoryManager } from '../core/memoryManager';
import { Logger } from '../utils/logger';
import { IMPORTANT_FILES, IGNORED_PATTERNS, THROTTLE } from '../utils/constants';

export class FileWatcher {
    private memoryManager: MemoryManager;
    private watcher: vscode.FileSystemWatcher | null = null;
    private lastCapture: Map<string, number> = new Map();
    private disposables: vscode.Disposable[] = [];

    constructor(memoryManager: MemoryManager) {
        this.memoryManager = memoryManager;
    }

    /**
     * Start watching for file changes.
     */
    start(context: vscode.ExtensionContext): void {
        // Watch for all file changes
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*');

        this.watcher.onDidChange(uri => this.onFileChanged(uri, 'modified'));
        this.watcher.onDidCreate(uri => this.onFileChanged(uri, 'created'));

        this.disposables.push(this.watcher);

        // Also capture when a document is saved
        const saveDisposable = vscode.workspace.onDidSaveTextDocument(doc => {
            this.onDocumentSaved(doc);
        });
        this.disposables.push(saveDisposable);

        context.subscriptions.push(...this.disposables);
    }

    /**
     * Stop watching.
     */
    stop(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.watcher = null;
    }

    /**
     * Handle file changes.
     */
    private async onFileChanged(uri: vscode.Uri, action: 'modified' | 'created'): Promise<void> {
        const filePath = uri.fsPath;
        const fileName = path.basename(filePath);

        // Check if file should be ignored
        if (this.shouldIgnore(filePath)) {
            return;
        }

        // Check throttle
        if (!this.shouldCapture(filePath)) {
            return;
        }

        // Check if it's an important file
        const isImportant = IMPORTANT_FILES.some(f =>
            fileName.toLowerCase() === f.toLowerCase()
        );

        if (!isImportant) {
            return; // Only capture important files automatically
        }

        this.lastCapture.set(filePath, Date.now());

        // Capture the event
        const relativePath = vscode.workspace.asRelativePath(uri);
        const content = `${action === 'created' ? 'Created' : 'Modified'} ${relativePath}`;

        await this.memoryManager.remember(content, 'episodic', {
            importance: 0.5,
            tags: ['file', action, this.getFileType(fileName)],
            source: 'file-watcher',
            metadata: {
                file: relativePath,
                action,
            },
        });

        Logger.debug(`Captured file ${action}: ${relativePath}`);
    }

    /**
     * Handle document saves (for tracking work sessions).
     */
    private async onDocumentSaved(document: vscode.TextDocument): Promise<void> {
        // Only track code files, not settings
        if (document.uri.scheme !== 'file') {
            return;
        }

        const filePath = document.uri.fsPath;
        if (this.shouldIgnore(filePath)) {
            return;
        }

        // Check throttle
        if (!this.shouldCapture(filePath)) {
            return;
        }

        this.lastCapture.set(filePath, Date.now());

        const relativePath = vscode.workspace.asRelativePath(document.uri);
        const lineCount = document.lineCount;
        const languageId = document.languageId;

        // Don't create memory for every save, just track in metadata
        Logger.debug(`File saved: ${relativePath} (${lineCount} lines, ${languageId})`);
    }

    /**
     * Check if file should be ignored.
     */
    private shouldIgnore(filePath: string): boolean {
        const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
        return IGNORED_PATTERNS.some(pattern => normalizedPath.includes(pattern.toLowerCase()));
    }

    /**
     * Check if enough time has passed since last capture.
     */
    private shouldCapture(filePath: string): boolean {
        const lastTime = this.lastCapture.get(filePath);
        if (!lastTime) {
            return true;
        }
        return Date.now() - lastTime >= THROTTLE.FILE_CAPTURE_MS;
    }

    /**
     * Get file type tag from filename.
     */
    private getFileType(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const typeMap: Record<string, string> = {
            '.ts': 'typescript',
            '.js': 'javascript',
            '.py': 'python',
            '.go': 'go',
            '.rs': 'rust',
            '.java': 'java',
            '.md': 'markdown',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.toml': 'toml',
        };
        return typeMap[ext] || 'other';
    }
}
