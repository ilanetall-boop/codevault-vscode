/**
 * Generates context blocks for AI agents.
 */

import * as vscode from 'vscode';
import { MemoryManager } from '../core/memoryManager';
import { ProjectAnalyzer } from '../core/projectAnalyzer';
import { Memory, ProjectKnowledge, RecallResult } from '../core/types';
import { Logger } from '../utils/logger';
import { getConfig, getAgentId, detectWorkspacePath } from '../utils/config';

export class ContextInjector {
    private memoryManager: MemoryManager;
    private analyzer: ProjectAnalyzer;

    constructor(memoryManager: MemoryManager, analyzer: ProjectAnalyzer) {
        this.memoryManager = memoryManager;
        this.analyzer = analyzer;
    }

    /**
     * Generate a context block based on current editor state.
     */
    async generateContext(): Promise<string> {
        const config = getConfig();
        const editor = vscode.window.activeTextEditor;

        // Debug: Log workspace detection and agent ID
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceName = vscode.workspace.name;
        Logger.info(`[ContextInjector] Workspace name: ${workspaceName}`);
        Logger.info(`[ContextInjector] Workspace folders: ${workspaceFolders?.length || 0}`);
        Logger.info(`[ContextInjector] Agent ID being used: ${getAgentId()}`);

        // Get workspace path with fallback to active file's directory
        const workspacePath = detectWorkspacePath();
        Logger.info(`[ContextInjector] Workspace path: ${workspacePath}`);

        // If no workspace detected at all, prompt user to open a folder
        if (!workspacePath) {
            const choice = await vscode.window.showWarningMessage(
                'CodeVault: No workspace detected. Open a folder for better context.',
                'Open Folder'
            );
            if (choice === 'Open Folder') {
                vscode.commands.executeCommand('vscode.openFolder');
            }
        }

        // Determine what query to use for memory recall
        let query = '';
        let currentFile = '';

        if (editor) {
            currentFile = vscode.workspace.asRelativePath(editor.document.uri);
            const selection = editor.selection;

            if (!selection.isEmpty) {
                query = editor.document.getText(selection).substring(0, 200);
            } else {
                query = `working on ${currentFile}`;
            }
        }
        Logger.info(`[ContextInjector] Current file: ${currentFile}, Query: ${query}`);

        // Get project knowledge - try from cache first, then analyze if needed
        let knowledge = this.memoryManager.getProjectKnowledge();
        Logger.info(`[ContextInjector] Cached project knowledge: ${knowledge ? 'YES' : 'NO'}`);

        // If no cached knowledge, try to analyze now
        if (!knowledge && workspacePath) {
            Logger.info('[ContextInjector] No cached knowledge, analyzing workspace...');
            try {
                knowledge = await this.analyzer.analyzeWorkspace();
                // Store it for future use
                await this.memoryManager.storeProjectKnowledge(knowledge);
                Logger.info(`[ContextInjector] Workspace analyzed: ${knowledge.name}`);
            } catch (error) {
                Logger.error('[ContextInjector] Failed to analyze workspace:', error);
            }
        }

        // Check if backend is connected
        const isConnected = this.memoryManager.isConnected;
        Logger.info(`[ContextInjector] Backend connected: ${isConnected}`);

        // Recall relevant memories with scores
        let recallResult: RecallResult = {
            memories: [],
            relevance_scores: [],
            total_found: 0,
            query_time_ms: 0,
        };

        let recentActivity: Memory[] = [];

        if (isConnected) {
            try {
                recallResult = await this.memoryManager.recall(query || 'project context', {
                    top_k: config.maxContextMemories,
                });
                Logger.info(`[ContextInjector] Recall returned ${recallResult.memories.length} memories`);

                // BONUS: If 0 memories found, auto-analyze the project and retry
                if (recallResult.memories.length === 0 && workspacePath) {
                    Logger.info('[ContextInjector] No memories found, auto-analyzing project...');
                    vscode.window.showInformationMessage('CodeVault: No memories found. Analyzing project...');
                    try {
                        knowledge = await this.analyzer.analyzeWorkspace();
                        await this.memoryManager.storeProjectKnowledge(knowledge);
                        Logger.info('[ContextInjector] Auto-analysis complete, retrying recall...');

                        // Retry recall after analysis
                        recallResult = await this.memoryManager.recall(query || 'project context', {
                            top_k: config.maxContextMemories,
                        });
                        Logger.info(`[ContextInjector] Retry recall returned ${recallResult.memories.length} memories`);
                    } catch (analyzeError) {
                        Logger.error('[ContextInjector] Auto-analysis failed:', analyzeError);
                    }
                }

                // Get recent activity (episodic memories)
                const activityResult = await this.memoryManager.recall('recent activity commit file change', {
                    top_k: 5,
                    types: ['episodic'],
                });
                recentActivity = activityResult.memories;
                Logger.info(`[ContextInjector] Recent activity: ${recentActivity.length} events`);
            } catch (error) {
                Logger.error('[ContextInjector] Failed to recall memories:', error);
            }
        } else {
            Logger.warn('[ContextInjector] Backend not connected, skipping memory recall');
        }

        // Build the context block
        const contextBlock = this.buildContextBlock(
            knowledge,
            recallResult,
            recentActivity,
            currentFile,
            workspacePath
        );

        Logger.info(`[ContextInjector] Generated context block: ${contextBlock.split('\n').length} lines`);
        return contextBlock;
    }

    /**
     * Build formatted context block.
     */
    private buildContextBlock(
        knowledge: ProjectKnowledge | null,
        recallResult: RecallResult,
        recentActivity: Memory[],
        currentFile: string,
        workspacePath: string
    ): string {
        const lines: string[] = [];

        lines.push('=== CodeVault Memory Context ===');
        lines.push('');

        // Project info section
        const projectName = knowledge?.name || this.getProjectNameFromPath(workspacePath);
        lines.push(`PROJECT: ${projectName}`);
        if (workspacePath) {
            lines.push(`PATH: ${workspacePath}`);
        }
        if (currentFile) {
            lines.push(`CURRENT FILE: ${currentFile}`);
        }
        lines.push('');

        // Stack section
        if (knowledge && (knowledge.stack.languages.length > 0 || knowledge.stack.frameworks.length > 0)) {
            lines.push('STACK:');
            if (knowledge.stack.languages.length > 0) {
                lines.push(`- Languages: ${knowledge.stack.languages.join(', ')}`);
            }
            if (knowledge.stack.frameworks.length > 0) {
                lines.push(`- Frameworks: ${knowledge.stack.frameworks.join(', ')}`);
            }
            if (knowledge.stack.tools.length > 0) {
                lines.push(`- Tools: ${knowledge.stack.tools.join(', ')}`);
            }
            if (knowledge.stack.infra.length > 0) {
                lines.push(`- Infra: ${knowledge.stack.infra.join(', ')}`);
            }
            lines.push('');
        }

        // Architecture section
        if (knowledge && Object.keys(knowledge.architecture.structure).length > 0) {
            lines.push('ARCHITECTURE:');
            const structure = knowledge.architecture.structure;
            const entries = Object.entries(structure).slice(0, 8);
            for (const [folder, description] of entries) {
                lines.push(`- ${folder}/: ${description}`);
            }
            if (knowledge.architecture.patterns.length > 0) {
                lines.push(`- Patterns: ${knowledge.architecture.patterns.join(', ')}`);
            }
            lines.push('');
        }

        // Relevant memories with scores (deduplicated)
        if (recallResult.memories.length > 0) {
            lines.push('RELEVANT MEMORIES:');

            const scores = recallResult.relevance_scores || [];
            const memoriesWithScores = recallResult.memories.map((mem, i) => ({
                memory: mem,
                score: scores[i] || 0
            }));

            memoriesWithScores.sort((a, b) => b.score - a.score);

            // Deduplicate by content — keep highest-scored version
            const seenContent = new Set<string>();
            let displayed = 0;
            for (const { memory, score } of memoriesWithScores) {
                if (displayed >= 10) { break; }
                try {
                    const content = memory.content || '(empty)';
                    const contentKey = content.toLowerCase().trim();
                    if (seenContent.has(contentKey)) { continue; }
                    seenContent.add(contentKey);

                    const typeLabel = this.getTypeLabel(memory.type || 'unknown');
                    const scoreStr = score > 0 ? ` (score: ${score.toFixed(2)})` : '';
                    lines.push(`- [${typeLabel}] ${this.truncate(content, 120)}${scoreStr}`);
                    displayed++;
                } catch (memError) {
                    Logger.error(`[ContextInjector] Error formatting memory: ${this.formatError(memError)}`);
                    lines.push(`- [error] Failed to format memory`);
                    displayed++;
                }
            }
            lines.push('');
        } else {
            lines.push('RELEVANT MEMORIES:');
            lines.push('- (No memories found - try running "CodeVault: Analyze Project" first)');
            lines.push('');
        }

        // Recent activity section (deduplicated)
        if (recentActivity.length > 0) {
            lines.push('RECENT ACTIVITY:');
            const seenActivity = new Set<string>();
            let activityCount = 0;
            for (const mem of recentActivity) {
                if (activityCount >= 5) { break; }
                try {
                    const content = mem.content || '(empty)';
                    const contentKey = content.toLowerCase().trim();
                    if (seenActivity.has(contentKey)) { continue; }
                    seenActivity.add(contentKey);

                    const date = new Date(mem.created_at);
                    const timeAgo = this.getTimeAgo(date);
                    lines.push(`- ${timeAgo}: ${this.truncate(content, 100)}`);
                    activityCount++;
                } catch (actError) {
                    Logger.error(`[ContextInjector] Error formatting activity: ${this.formatError(actError)}`);
                    lines.push(`- [error] Failed to format activity`);
                    activityCount++;
                }
            }
            lines.push('');
        }

        // Conventions section
        if (knowledge && knowledge.conventions) {
            try {
                const conventions = knowledge.conventions;
                const linting = conventions.linting || {};
                const formatting = conventions.formatting || {};
                const naming = conventions.naming || 'unknown';

                const hasConventions = naming !== 'unknown' ||
                    Object.keys(linting).length > 0 ||
                    Object.keys(formatting).length > 0;

                if (hasConventions) {
                    lines.push('CONVENTIONS:');
                    if (naming !== 'unknown') {
                        lines.push(`- Naming: ${naming}`);
                    }
                    if (Object.keys(linting).length > 0) {
                        lines.push(`- Linting: ${Object.keys(linting).join(', ')}`);
                    }
                    if (Object.keys(formatting).length > 0) {
                        lines.push(`- Formatting: ${Object.keys(formatting).join(', ')}`);
                    }
                    lines.push('');
                }
            } catch (convError) {
                Logger.error(`[ContextInjector] Error formatting conventions: ${this.formatError(convError)}`);
            }
        }

        // Decisions section (if any)
        if (knowledge && knowledge.decisions.length > 0) {
            lines.push('KEY DECISIONS:');
            for (const decision of knowledge.decisions.slice(0, 3)) {
                lines.push(`- ${this.truncate(decision, 100)}`);
            }
            lines.push('');
        }

        lines.push('================================');

        return lines.join('\n');
    }

    /**
     * Get type label for display.
     */
    private getTypeLabel(type: string): string {
        switch (type) {
            case 'semantic': return 'fact';
            case 'episodic': return 'event';
            case 'procedural': return 'how-to';
            default: return type;
        }
    }

    /**
     * Get project name from path.
     */
    private getProjectNameFromPath(pathStr: string): string {
        if (!pathStr) { return 'Unknown Project'; }
        const parts = pathStr.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1] || 'Unknown Project';
    }

    /**
     * Get human-readable time ago string.
     */
    private getTimeAgo(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) { return 'just now'; }
        if (diffMins < 60) { return `${diffMins}m ago`; }
        if (diffHours < 24) { return `${diffHours}h ago`; }
        if (diffDays < 7) { return `${diffDays}d ago`; }
        return date.toLocaleDateString();
    }

    /**
     * Truncate text to max length.
     */
    private truncate(text: string, maxLength: number): string {
        const cleaned = text.replace(/\s+/g, ' ').trim();
        if (cleaned.length <= maxLength) {
            return cleaned;
        }
        return cleaned.substring(0, maxLength - 3) + '...';
    }

    /**
     * Format an error for logging (handles empty Error objects that serialize to "{}").
     */
    private formatError(error: unknown): string {
        if (error instanceof Error) {
            return `message: ${error.message || '(empty)'}\nstack: ${error.stack || '(no stack)'}`;
        }
        try {
            const json = JSON.stringify(error);
            return json === '{}' ? `${String(error)} (stringified: {})` : json;
        } catch {
            return String(error);
        }
    }

    /**
     * Copy context to clipboard and notify user.
     */
    async exportToClipboard(): Promise<void> {
        Logger.info('[ContextInjector] === Export to clipboard started ===');

        // Step 1: Generate context
        let context: string;
        try {
            Logger.info('[ContextInjector] Step 1: Generating context...');
            context = await this.generateContext();
            Logger.info(`[ContextInjector] Step 1 OK: Generated ${context.length} chars, ${context.split('\n').length} lines`);
        } catch (error) {
            Logger.error(`[ContextInjector] Step 1 FAILED: generateContext() threw:\n${this.formatError(error)}`);
            vscode.window.showErrorMessage('CodeVault: Failed to generate context. Check Output panel.');
            return;
        }

        // Step 2: Log full context before clipboard
        try {
            Logger.info('[ContextInjector] Step 2: Full context block to copy:');
            Logger.info('--- BEGIN CONTEXT ---');
            Logger.info(context);
            Logger.info('--- END CONTEXT ---');
        } catch (error) {
            Logger.error(`[ContextInjector] Step 2 FAILED: logging context threw:\n${this.formatError(error)}`);
        }

        // Step 3: Copy to clipboard (with fallback to text document)
        let clipboardOk = false;
        try {
            Logger.info('[ContextInjector] Step 3: Writing to clipboard...');
            await vscode.env.clipboard.writeText(context);
            clipboardOk = true;
            Logger.info('[ContextInjector] Step 3 OK: Clipboard write succeeded');
        } catch (error) {
            Logger.error(`[ContextInjector] Step 3 FAILED: clipboard.writeText() threw:\n${this.formatError(error)}`);
        }

        // Step 3b: Fallback — open as untitled text document
        if (!clipboardOk) {
            try {
                Logger.info('[ContextInjector] Step 3b: Clipboard failed, opening as text document...');
                const doc = await vscode.workspace.openTextDocument({ content: context, language: 'markdown' });
                await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
                vscode.window.showWarningMessage(
                    'CodeVault: Clipboard unavailable. Context opened in a new tab — copy it manually.'
                );
                Logger.info('[ContextInjector] Step 3b OK: Opened fallback text document');
            } catch (fallbackError) {
                Logger.error(`[ContextInjector] Step 3b FAILED: fallback document threw:\n${this.formatError(fallbackError)}`);
                vscode.window.showErrorMessage('CodeVault: Failed to export context. Check Output panel.');
                return;
            }
        }

        // Step 4: Show success notification
        try {
            Logger.info('[ContextInjector] Step 4: Showing notification...');
            const message = clipboardOk
                ? 'Memory context copied! Paste it in your agent conversation.'
                : 'Context opened in new tab. Copy it manually.';
            vscode.window.showInformationMessage(message, 'Show Preview').then(choice => {
                if (choice === 'Show Preview') {
                    this.showPreview(context);
                }
            });
            Logger.info('[ContextInjector] === Export complete ===');
        } catch (error) {
            Logger.error(`[ContextInjector] Step 4 FAILED: notification threw:\n${this.formatError(error)}`);
        }
    }

    /**
     * Show context in a preview panel.
     */
    private showPreview(context: string): void {
        const panel = vscode.window.createWebviewPanel(
            'codevaultContext',
            'CodeVault Context Preview',
            vscode.ViewColumn.Beside,
            {}
        );

        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        color: var(--vscode-foreground);
                        background: var(--vscode-editor-background);
                    }
                    pre {
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        background: var(--vscode-textBlockQuote-background);
                        padding: 15px;
                        border-radius: 5px;
                        border-left: 3px solid var(--vscode-textLink-foreground);
                        font-size: 13px;
                        line-height: 1.5;
                    }
                    h2 {
                        color: var(--vscode-textLink-foreground);
                    }
                    .stats {
                        margin-top: 10px;
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                    }
                </style>
            </head>
            <body>
                <h2>Context to paste in your agent conversation:</h2>
                <pre>${this.escapeHtml(context)}</pre>
                <p class="stats">${context.split('\n').length} lines | ${context.length} characters</p>
            </body>
            </html>
        `;
    }

    /**
     * Escape HTML special characters.
     */
    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
