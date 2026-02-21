/**
 * Clipboard export utilities.
 */

import * as vscode from 'vscode';
import { Memory } from '../core/types';

export class ClipboardExport {
    /**
     * Copy memories as formatted text.
     */
    static async copyMemories(memories: Memory[]): Promise<void> {
        if (memories.length === 0) {
            vscode.window.showWarningMessage('No memories to copy');
            return;
        }

        const lines: string[] = [];
        lines.push('# Memories from CodeVault');
        lines.push('');

        for (const mem of memories) {
            lines.push(`## [${mem.type}] ${new Date(mem.created_at).toLocaleDateString()}`);
            lines.push('');
            lines.push(mem.content);
            lines.push('');
            if (mem.tags.length > 0) {
                lines.push(`Tags: ${mem.tags.join(', ')}`);
            }
            lines.push(`Importance: ${mem.importance.toFixed(2)}`);
            lines.push('');
            lines.push('---');
            lines.push('');
        }

        await vscode.env.clipboard.writeText(lines.join('\n'));
        vscode.window.showInformationMessage(`Copied ${memories.length} memories to clipboard`);
    }

    /**
     * Copy a single memory.
     */
    static async copyMemory(memory: Memory): Promise<void> {
        await vscode.env.clipboard.writeText(memory.content);
        vscode.window.showInformationMessage('Memory copied to clipboard');
    }

    /**
     * Copy memories as JSON.
     */
    static async copyAsJson(memories: Memory[]): Promise<void> {
        const json = JSON.stringify(memories, null, 2);
        await vscode.env.clipboard.writeText(json);
        vscode.window.showInformationMessage(`Copied ${memories.length} memories as JSON`);
    }
}
