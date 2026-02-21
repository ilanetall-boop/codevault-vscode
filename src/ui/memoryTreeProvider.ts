/**
 * Tree view provider for displaying memories.
 */

import * as vscode from 'vscode';
import { MemoryManager } from '../core/memoryManager';
import { Memory, MemoryType } from '../core/types';
import { Logger } from '../utils/logger';
// Colors are defined inline in getIconPath

export class MemoryTreeProvider implements vscode.TreeDataProvider<MemoryTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<MemoryTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private memoryManager: MemoryManager;
    private memories: Memory[] = [];

    constructor(memoryManager: MemoryManager) {
        this.memoryManager = memoryManager;
    }

    /**
     * Refresh the tree view.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get tree item for display.
     */
    getTreeItem(element: MemoryTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children (memories grouped by type).
     */
    async getChildren(element?: MemoryTreeItem): Promise<MemoryTreeItem[]> {
        if (!element) {
            // Root level: show categories
            return this.getCategories();
        }

        if (element.contextValue === 'category') {
            // Category level: show memories of that type
            return this.getMemoriesOfType(element.memoryType!);
        }

        return [];
    }

    /**
     * Get category items.
     */
    private async getCategories(): Promise<MemoryTreeItem[]> {
        try {
            this.memories = await this.memoryManager.getAllMemories(100);
        } catch (error) {
            Logger.error('Failed to load memories:', error);
            this.memories = [];
        }

        const semantic = this.memories.filter(m => m.type === 'semantic');
        const episodic = this.memories.filter(m => m.type === 'episodic');
        const procedural = this.memories.filter(m => m.type === 'procedural');

        const items: MemoryTreeItem[] = [];

        if (semantic.length > 0) {
            items.push(new MemoryTreeItem(
                `Facts (${semantic.length})`,
                vscode.TreeItemCollapsibleState.Expanded,
                'category',
                'semantic'
            ));
        }

        if (episodic.length > 0) {
            items.push(new MemoryTreeItem(
                `Events (${episodic.length})`,
                vscode.TreeItemCollapsibleState.Expanded,
                'category',
                'episodic'
            ));
        }

        if (procedural.length > 0) {
            items.push(new MemoryTreeItem(
                `How-tos (${procedural.length})`,
                vscode.TreeItemCollapsibleState.Expanded,
                'category',
                'procedural'
            ));
        }

        if (items.length === 0) {
            items.push(new MemoryTreeItem(
                'No memories yet',
                vscode.TreeItemCollapsibleState.None,
                'empty'
            ));
        }

        return items;
    }

    /**
     * Get memories of a specific type.
     */
    private getMemoriesOfType(type: MemoryType): MemoryTreeItem[] {
        const filtered = this.memories.filter(m => m.type === type);

        return filtered.map(memory => {
            const item = new MemoryTreeItem(
                this.truncate(memory.content, 50),
                vscode.TreeItemCollapsibleState.None,
                'memory',
                type,
                memory
            );

            // Set tooltip with full content
            item.tooltip = new vscode.MarkdownString();
            item.tooltip.appendMarkdown(`**${memory.type}** | Importance: ${memory.importance.toFixed(2)}\n\n`);
            item.tooltip.appendMarkdown(memory.content);
            if (memory.tags.length > 0) {
                item.tooltip.appendMarkdown(`\n\n*Tags: ${memory.tags.join(', ')}*`);
            }

            // Set description (time ago)
            item.description = this.timeAgo(new Date(memory.created_at));

            // Set icon based on type
            item.iconPath = this.getIconForType(type);

            return item;
        });
    }

    /**
     * Get icon for memory type.
     */
    private getIconForType(type: MemoryType): vscode.ThemeIcon {
        switch (type) {
            case 'semantic':
                return new vscode.ThemeIcon('lightbulb', new vscode.ThemeColor('charts.green'));
            case 'episodic':
                return new vscode.ThemeIcon('history', new vscode.ThemeColor('charts.blue'));
            case 'procedural':
                return new vscode.ThemeIcon('checklist', new vscode.ThemeColor('charts.orange'));
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }

    /**
     * Truncate text.
     */
    private truncate(text: string, maxLength: number): string {
        const cleaned = text.replace(/\s+/g, ' ').trim();
        if (cleaned.length <= maxLength) {
            return cleaned;
        }
        return cleaned.substring(0, maxLength) + '...';
    }

    /**
     * Format time ago.
     */
    private timeAgo(date: Date): string {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

        if (seconds < 60) {return 'just now';}
        if (seconds < 3600) {return `${Math.floor(seconds / 60)}m ago`;}
        if (seconds < 86400) {return `${Math.floor(seconds / 3600)}h ago`;}
        if (seconds < 604800) {return `${Math.floor(seconds / 86400)}d ago`;}
        return date.toLocaleDateString();
    }
}

/**
 * Tree item for memories.
 */
export class MemoryTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly memoryType?: MemoryType,
        public readonly memory?: Memory
    ) {
        super(label, collapsibleState);

        if (memory) {
            this.command = {
                command: 'codevault.showMemoryDetail',
                title: 'Show Memory',
                arguments: [memory],
            };
        }
    }
}
