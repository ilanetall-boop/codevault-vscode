/**
 * High-level memory management for the extension.
 */

import * as vscode from 'vscode';
import { MemoryClient } from './memoryClient';
import { Memory, MemoryType, RecallResult, ProjectKnowledge, CreateMemoryRequest } from './types';
import { Logger } from '../utils/logger';
import { getAgentId } from '../utils/config';

export class MemoryManager {
    private client: MemoryClient;
    private config: vscode.WorkspaceConfiguration;
    private projectKnowledge: ProjectKnowledge | null = null;

    constructor(client: MemoryClient, config: vscode.WorkspaceConfiguration) {
        this.client = client;
        this.config = config;
    }

    /**
     * Store a new memory.
     */
    async remember(
        content: string,
        type?: MemoryType,
        options: {
            importance?: number;
            tags?: string[];
            source?: string;
            metadata?: Record<string, unknown>;
        } = {}
    ): Promise<Memory | null> {
        const request: CreateMemoryRequest = {
            agent_id: getAgentId(),
            content,
            type,
            importance: options.importance,
            tags: options.tags,
            source: options.source,
            metadata: options.metadata,
        };

        return this.client.remember(request);
    }

    /**
     * Recall memories relevant to a query.
     */
    async recall(
        query: string,
        options: {
            top_k?: number;
            types?: MemoryType[];
            min_importance?: number;
            tags?: string[];
        } = {}
    ): Promise<RecallResult> {
        return this.client.recall({
            agent_id: getAgentId(),
            query,
            top_k: options.top_k || this.config.get('maxContextMemories', 10),
            types: options.types,
            min_importance: options.min_importance,
            tags: options.tags,
        });
    }

    /**
     * Delete a memory.
     */
    async forget(memoryId: string): Promise<boolean> {
        return this.client.forget(memoryId);
    }

    /**
     * Get all memories for the current agent.
     */
    async getAllMemories(limit: number = 100): Promise<Memory[]> {
        return this.client.getMemories(getAgentId(), limit);
    }

    /**
     * Get memory count and stats.
     */
    async getStats(): Promise<{ total: number; byType: Record<MemoryType, number> } | null> {
        const stats = await this.client.getStats(getAgentId());
        if (!stats) {return null;}

        return {
            total: stats.total_memories,
            byType: stats.by_type as Record<MemoryType, number>,
        };
    }

    /**
     * Store project knowledge as semantic memories.
     */
    async storeProjectKnowledge(knowledge: ProjectKnowledge): Promise<void> {
        this.projectKnowledge = knowledge;

        // Store stack info
        if (knowledge.stack.languages.length > 0) {
            await this.remember(
                `Project "${knowledge.name}" uses: ${knowledge.stack.languages.join(', ')}`,
                'semantic',
                {
                    importance: 0.9,
                    tags: ['project', 'stack', 'language'],
                    source: 'project-analyzer',
                }
            );
        }

        if (knowledge.stack.frameworks.length > 0) {
            await this.remember(
                `Frameworks: ${knowledge.stack.frameworks.join(', ')}`,
                'semantic',
                {
                    importance: 0.8,
                    tags: ['project', 'stack', 'framework'],
                    source: 'project-analyzer',
                }
            );
        }

        if (knowledge.stack.tools.length > 0) {
            await this.remember(
                `Development tools: ${knowledge.stack.tools.join(', ')}`,
                'semantic',
                {
                    importance: 0.7,
                    tags: ['project', 'stack', 'tools'],
                    source: 'project-analyzer',
                }
            );
        }

        // Store architecture patterns
        if (knowledge.architecture.patterns.length > 0) {
            await this.remember(
                `Architecture patterns: ${knowledge.architecture.patterns.join(', ')}`,
                'semantic',
                {
                    importance: 0.8,
                    tags: ['project', 'architecture'],
                    source: 'project-analyzer',
                }
            );
        }

        // Store entry points
        if (knowledge.architecture.entryPoints.length > 0) {
            await this.remember(
                `Entry points: ${knowledge.architecture.entryPoints.join(', ')}`,
                'semantic',
                {
                    importance: 0.6,
                    tags: ['project', 'architecture', 'entrypoint'],
                    source: 'project-analyzer',
                }
            );
        }

        // Store naming convention
        if (knowledge.conventions.naming !== 'unknown') {
            await this.remember(
                `Naming convention: ${knowledge.conventions.naming}`,
                'semantic',
                {
                    importance: 0.7,
                    tags: ['project', 'conventions', 'naming'],
                    source: 'project-analyzer',
                }
            );
        }

        Logger.info('Project knowledge stored');
    }

    /**
     * Get cached project knowledge.
     */
    getProjectKnowledge(): ProjectKnowledge | null {
        return this.projectKnowledge;
    }

    /**
     * Check if backend is connected.
     */
    get isConnected(): boolean {
        return this.client.connected;
    }

    /**
     * Get queue size.
     */
    get queueSize(): number {
        return this.client.queueSize;
    }

    /**
     * List all available agents.
     */
    async listAgents(): Promise<Array<{ agent_id: string; memory_count: number }>> {
        return this.client.listAgents();
    }

    /**
     * Perform health check.
     */
    async healthCheck(): Promise<boolean> {
        return this.client.healthCheck();
    }

    /**
     * Get the underlying client.
     */
    getClient(): MemoryClient {
        return this.client;
    }
}
