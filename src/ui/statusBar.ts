/**
 * Status bar indicator for CodeVault.
 */

import * as vscode from 'vscode';
import { MemoryManager } from '../core/memoryManager';
// Status bar doesn't need logging

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private memoryManager: MemoryManager;
    private updateInterval: NodeJS.Timeout | null = null;

    constructor(memoryManager: MemoryManager) {
        this.memoryManager = memoryManager;
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );

        this.statusBarItem.command = 'codevault.showMemories';
    }

    /**
     * Show the status bar item and start updates.
     */
    show(): void {
        this.update();
        this.statusBarItem.show();

        // Update every 30 seconds
        this.updateInterval = setInterval(() => {
            this.update();
        }, 30000);
    }

    /**
     * Hide the status bar item.
     */
    hide(): void {
        this.statusBarItem.hide();
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Update the status bar content.
     */
    private async update(): Promise<void> {
        const connected = this.memoryManager.isConnected;
        const queueSize = this.memoryManager.queueSize;

        let text = '$(brain) CodeVault';
        let tooltip = 'CodeVault - Memory for AI Agents\n\n';
        let color: string | undefined;

        if (!connected) {
            text = '$(brain) CodeVault $(warning)';
            tooltip += 'Status: Disconnected\n';
            tooltip += 'Click to show memories\n';
            color = 'yellow';

            if (queueSize > 0) {
                tooltip += `\n${queueSize} memories queued`;
            }
        } else {
            const stats = await this.memoryManager.getStats();
            if (stats) {
                text = `$(brain) ${stats.total}`;
                tooltip += `Status: Connected\n`;
                tooltip += `Total memories: ${stats.total}\n`;
                tooltip += `  - Facts: ${stats.byType.semantic}\n`;
                tooltip += `  - Events: ${stats.byType.episodic}\n`;
                tooltip += `  - How-tos: ${stats.byType.procedural}\n`;
            } else {
                text = '$(brain) CodeVault';
                tooltip += 'Status: Connected\n';
            }
            tooltip += '\nClick to show memories';
            color = undefined;
        }

        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.color = color;
    }

    /**
     * Dispose resources.
     */
    dispose(): void {
        this.hide();
        this.statusBarItem.dispose();
    }
}
