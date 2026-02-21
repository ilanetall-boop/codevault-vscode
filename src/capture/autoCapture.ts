/**
 * Auto-capture engine that monitors and captures project events.
 */

import * as vscode from 'vscode';
import { MemoryManager } from '../core/memoryManager';
import { ProjectAnalyzer } from '../core/projectAnalyzer';
import { FileWatcher } from './fileWatcher';
import { GitCapture } from './gitCapture';
import { TerminalCapture } from './terminalCapture';
import { Logger } from '../utils/logger';
import { THROTTLE } from '../utils/constants';
import { getConfig } from '../utils/config';

export class AutoCapture {
    private memoryManager: MemoryManager;
    private analyzer: ProjectAnalyzer;
    private fileWatcher: FileWatcher | null = null;
    private gitCapture: GitCapture | null = null;
    private terminalCapture: TerminalCapture | null = null;
    private captureCount: number = 0;
    private captureResetInterval: NodeJS.Timeout | null = null;
    private disposables: vscode.Disposable[] = [];

    constructor(memoryManager: MemoryManager, analyzer: ProjectAnalyzer) {
        this.memoryManager = memoryManager;
        this.analyzer = analyzer;
    }

    /**
     * Start auto-capture listeners.
     */
    start(context: vscode.ExtensionContext): void {
        const config = getConfig();

        // File watching
        if (config.autoCaptureFiles) {
            this.fileWatcher = new FileWatcher(this.memoryManager);
            this.fileWatcher.start(context);
            Logger.info('File watcher started');
        }

        // Git capture
        if (config.autoCaptureGit) {
            this.gitCapture = new GitCapture(this.memoryManager);
            this.gitCapture.start(context);
            Logger.info('Git capture started');
        }

        // Terminal capture
        this.terminalCapture = new TerminalCapture(this.memoryManager);
        this.terminalCapture.start(context);
        Logger.info('Terminal capture started');

        // Reset capture count every hour
        this.captureResetInterval = setInterval(() => {
            this.captureCount = 0;
        }, 3600000);

        Logger.info('Auto-capture started');
    }

    /**
     * Stop auto-capture listeners.
     */
    stop(): void {
        if (this.fileWatcher) {
            this.fileWatcher.stop();
            this.fileWatcher = null;
        }

        if (this.gitCapture) {
            this.gitCapture.stop();
            this.gitCapture = null;
        }

        if (this.terminalCapture) {
            this.terminalCapture.stop();
            this.terminalCapture = null;
        }

        if (this.captureResetInterval) {
            clearInterval(this.captureResetInterval);
            this.captureResetInterval = null;
        }

        this.disposables.forEach(d => d.dispose());
        this.disposables = [];

        Logger.info('Auto-capture stopped');
    }

    /**
     * Check if we can capture (respecting throttle limits).
     */
    canCapture(): boolean {
        return this.captureCount < THROTTLE.MAX_CAPTURES_PER_HOUR;
    }

    /**
     * Increment capture count.
     */
    incrementCaptureCount(): void {
        this.captureCount++;
    }

    /**
     * Get current capture count.
     */
    getCaptureCount(): number {
        return this.captureCount;
    }
}
