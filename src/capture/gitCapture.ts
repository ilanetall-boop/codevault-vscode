/**
 * Captures git events (commits, branch changes).
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MemoryManager } from '../core/memoryManager';
import { Logger } from '../utils/logger';
import { THROTTLE } from '../utils/constants';

export class GitCapture {
    private memoryManager: MemoryManager;
    private lastCommitHash: string | null = null;
    private lastBranch: string | null = null;
    private checkInterval: NodeJS.Timeout | null = null;
    private workspaceRoot: string | undefined;

    constructor(memoryManager: MemoryManager) {
        this.memoryManager = memoryManager;
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            this.workspaceRoot = folders[0].uri.fsPath;
        }
    }

    /**
     * Start monitoring git changes.
     */
    start(_context: vscode.ExtensionContext): void {
        if (!this.workspaceRoot || !this.isGitRepo()) {
            Logger.info('Not a git repository, git capture disabled');
            return;
        }

        // Initial state
        this.lastCommitHash = this.getCurrentCommitHash();
        this.lastBranch = this.getCurrentBranch();

        // Check for changes periodically
        this.checkInterval = setInterval(() => {
            this.checkForChanges();
        }, THROTTLE.GIT_CAPTURE_MS);

        Logger.info('Git capture initialized');
    }

    /**
     * Stop monitoring.
     */
    stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Check if current directory is a git repo.
     */
    private isGitRepo(): boolean {
        if (!this.workspaceRoot) {return false;}
        return fs.existsSync(path.join(this.workspaceRoot, '.git'));
    }

    /**
     * Get current commit hash.
     */
    private getCurrentCommitHash(): string | null {
        if (!this.workspaceRoot) {return null;}

        try {
            const headPath = path.join(this.workspaceRoot, '.git', 'HEAD');
            const headContent = fs.readFileSync(headPath, 'utf-8').trim();

            if (headContent.startsWith('ref: ')) {
                // It's a reference to a branch
                const refPath = path.join(this.workspaceRoot, '.git', headContent.substring(5));
                if (fs.existsSync(refPath)) {
                    return fs.readFileSync(refPath, 'utf-8').trim().substring(0, 7);
                }
            } else {
                // Direct commit hash
                return headContent.substring(0, 7);
            }
        } catch {
            return null;
        }
        return null;
    }

    /**
     * Get current branch name.
     */
    private getCurrentBranch(): string | null {
        if (!this.workspaceRoot) {return null;}

        try {
            const headPath = path.join(this.workspaceRoot, '.git', 'HEAD');
            const headContent = fs.readFileSync(headPath, 'utf-8').trim();

            if (headContent.startsWith('ref: refs/heads/')) {
                return headContent.substring('ref: refs/heads/'.length);
            }
        } catch {
            return null;
        }
        return null;
    }

    /**
     * Get latest commit message.
     */
    private getLatestCommitMessage(): string | null {
        if (!this.workspaceRoot) {return null;}

        try {
            const commitMsgPath = path.join(this.workspaceRoot, '.git', 'COMMIT_EDITMSG');
            if (fs.existsSync(commitMsgPath)) {
                return fs.readFileSync(commitMsgPath, 'utf-8').trim().split('\n')[0];
            }
        } catch {
            return null;
        }
        return null;
    }

    /**
     * Check for git changes and capture them.
     */
    private async checkForChanges(): Promise<void> {
        const currentHash = this.getCurrentCommitHash();
        const currentBranch = this.getCurrentBranch();

        // Check for new commit
        if (currentHash && currentHash !== this.lastCommitHash) {
            const commitMsg = this.getLatestCommitMessage();
            if (commitMsg) {
                await this.captureCommit(currentHash, commitMsg);
            }
            this.lastCommitHash = currentHash;
        }

        // Check for branch change
        if (currentBranch && currentBranch !== this.lastBranch) {
            await this.captureBranchChange(this.lastBranch, currentBranch);
            this.lastBranch = currentBranch;
        }
    }

    /**
     * Capture a commit event.
     */
    private async captureCommit(hash: string, message: string): Promise<void> {
        // Store as episodic memory
        await this.memoryManager.remember(
            `Committed: ${message}`,
            'episodic',
            {
                importance: 0.7,
                tags: ['git', 'commit'],
                source: 'git-capture',
                metadata: { hash },
            }
        );

        // Also extract semantic knowledge if it's a significant commit
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes('fix') || lowerMsg.includes('bug')) {
            await this.memoryManager.remember(
                `Bug fix: ${message}`,
                'semantic',
                {
                    importance: 0.8,
                    tags: ['git', 'bugfix'],
                    source: 'git-capture',
                }
            );
        } else if (lowerMsg.includes('feat') || lowerMsg.includes('add')) {
            await this.memoryManager.remember(
                `New feature: ${message}`,
                'semantic',
                {
                    importance: 0.8,
                    tags: ['git', 'feature'],
                    source: 'git-capture',
                }
            );
        }

        Logger.info(`Captured commit: ${hash} - ${message.substring(0, 50)}`);
    }

    /**
     * Capture branch change event.
     */
    private async captureBranchChange(from: string | null, to: string): Promise<void> {
        const content = from
            ? `Switched branch: ${from} → ${to}`
            : `On branch: ${to}`;

        await this.memoryManager.remember(content, 'episodic', {
            importance: 0.5,
            tags: ['git', 'branch'],
            source: 'git-capture',
            metadata: { from, to },
        });

        Logger.info(`Captured branch change: ${content}`);
    }
}
