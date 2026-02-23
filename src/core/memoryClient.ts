/**
 * HTTP client for communicating with AgentVault backend.
 */

import {
    Memory,
    RecallResult,
    CreateMemoryRequest,
    SearchRequest,
    HealthResponse,
    AgentStats,
    QueuedMemory,
} from './types';
import { ENDPOINTS } from '../utils/constants';
import { Logger } from '../utils/logger';

export class MemoryClient {
    private baseUrl: string;
    private queue: QueuedMemory[] = [];
    private isConnected: boolean = false;
    private retryInterval: NodeJS.Timeout | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    /**
     * Check if the backend is healthy.
     */
    async healthCheck(): Promise<boolean> {
        try {
            Logger.info(`[MemoryClient] Health check to ${this.baseUrl}${ENDPOINTS.HEALTH}`);
            const response = await this.fetch(ENDPOINTS.HEALTH);
            if (response.ok) {
                const data = await response.json() as HealthResponse;
                this.isConnected = data.status === 'healthy';
                Logger.info(`[MemoryClient] Health check result: ${data.status}, isConnected: ${this.isConnected}`);
                if (this.isConnected) {
                    this.processQueue();
                }
                return this.isConnected;
            }
            Logger.warn(`[MemoryClient] Health check failed with status ${response.status}`);
            this.isConnected = false;
            return false;
        } catch (error) {
            Logger.warn('[MemoryClient] Backend health check failed:', error);
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Store a new memory.
     */
    async remember(request: CreateMemoryRequest): Promise<Memory | null> {
        if (!this.isConnected) {
            this.queueMemory(request);
            return null;
        }

        try {
            const response = await this.fetch(ENDPOINTS.MEMORIES, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
            });

            if (response.ok) {
                const memory = await response.json() as Memory;
                Logger.info(`Memory created: ${memory.id}`);
                return memory;
            } else {
                const error = await response.text();
                Logger.error(`Failed to create memory: ${error}`);
                this.queueMemory(request);
                return null;
            }
        } catch (error) {
            Logger.error('Error creating memory:', error);
            this.queueMemory(request);
            this.isConnected = false;
            this.startRetryInterval();
            return null;
        }
    }

    /**
     * Search for relevant memories.
     */
    async recall(request: SearchRequest): Promise<RecallResult> {
        const emptyResult: RecallResult = {
            memories: [],
            relevance_scores: [],
            total_found: 0,
            query_time_ms: 0,
        };

        Logger.info(`[MemoryClient] recall() called with agent_id: ${request.agent_id}, query: "${request.query}"`);

        if (!this.isConnected) {
            Logger.warn('[MemoryClient] Backend not connected, cannot recall memories');
            return emptyResult;
        }

        try {
            Logger.info(`[MemoryClient] Sending search request to ${this.baseUrl}${ENDPOINTS.SEARCH}`);
            const response = await this.fetch(ENDPOINTS.SEARCH, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
            });

            if (response.ok) {
                const result = await response.json() as RecallResult;
                Logger.info(`[MemoryClient] Recalled ${result.total_found} memories in ${result.query_time_ms}ms`);
                if (result.memories.length > 0) {
                    Logger.info(`[MemoryClient] First memory: ${result.memories[0].content.substring(0, 50)}...`);
                }
                return result;
            } else {
                const errorText = await response.text();
                Logger.error(`[MemoryClient] Failed to recall memories (${response.status}): ${errorText}`);
                return emptyResult;
            }
        } catch (error) {
            Logger.error('[MemoryClient] Error recalling memories:', error);
            this.isConnected = false;
            this.startRetryInterval();
            return emptyResult;
        }
    }

    /**
     * Get a specific memory by ID.
     */
    async getMemory(memoryId: string): Promise<Memory | null> {
        if (!this.isConnected) {
            return null;
        }

        try {
            const response = await this.fetch(`${ENDPOINTS.MEMORIES}/${memoryId}`);
            if (response.ok) {
                return await response.json() as Memory;
            }
            return null;
        } catch (error) {
            Logger.error('Error getting memory:', error);
            return null;
        }
    }

    /**
     * Delete a memory by ID.
     */
    async forget(memoryId: string): Promise<boolean> {
        if (!this.isConnected) {
            Logger.warn('Backend not connected, cannot forget memory');
            return false;
        }

        try {
            const response = await this.fetch(`${ENDPOINTS.MEMORIES}/${memoryId}`, {
                method: 'DELETE',
            });
            if (response.ok || response.status === 204) {
                Logger.info(`Memory deleted: ${memoryId}`);
                return true;
            }
            return false;
        } catch (error) {
            Logger.error('Error deleting memory:', error);
            return false;
        }
    }

    /**
     * Get stats for an agent.
     */
    async getStats(agentId: string): Promise<AgentStats | null> {
        if (!this.isConnected) {
            return null;
        }

        try {
            const response = await this.fetch(`${ENDPOINTS.AGENTS}/${agentId}/stats`);
            if (response.ok) {
                return await response.json() as AgentStats;
            }
            return null;
        } catch (error) {
            Logger.error('Error getting stats:', error);
            return null;
        }
    }

    /**
     * Get all memories for an agent.
     */
    async getMemories(agentId: string, limit: number = 100): Promise<Memory[]> {
        if (!this.isConnected) {
            return [];
        }

        try {
            const response = await this.fetch(
                `${ENDPOINTS.AGENTS}/${agentId}/memories?limit=${limit}`
            );
            if (response.ok) {
                const data = await response.json() as { memories?: Memory[] };
                return data.memories || [];
            }
            return [];
        } catch (error) {
            Logger.error('Error getting memories:', error);
            return [];
        }
    }

    /**
     * List all agents that have stored memories.
     */
    async listAgents(): Promise<Array<{ agent_id: string; memory_count: number }>> {
        if (!this.isConnected) {
            return [];
        }

        try {
            const response = await this.fetch(ENDPOINTS.AGENTS);
            if (response.ok) {
                const data = await response.json() as { agents?: Array<{ agent_id: string; memory_count: number }> };
                return data.agents || [];
            }
            return [];
        } catch (error) {
            Logger.error('Error listing agents:', error);
            return [];
        }
    }

    /**
     * Check connection status.
     */
    get connected(): boolean {
        return this.isConnected;
    }

    /**
     * Get number of queued memories.
     */
    get queueSize(): number {
        return this.queue.length;
    }

    /**
     * Queue a memory for later processing.
     */
    private queueMemory(request: CreateMemoryRequest): void {
        this.queue.push({
            request,
            timestamp: new Date(),
            retries: 0,
        });
        Logger.info(`Memory queued (queue size: ${this.queue.length})`);
        this.startRetryInterval();
    }

    /**
     * Process queued memories.
     */
    private async processQueue(): Promise<void> {
        if (this.queue.length === 0) {
            this.stopRetryInterval();
            return;
        }

        Logger.info(`Processing ${this.queue.length} queued memories...`);

        const toProcess = [...this.queue];
        this.queue = [];

        for (const item of toProcess) {
            if (item.retries >= 3) {
                Logger.warn('Dropping memory after 3 retries:', item.request.content.slice(0, 50));
                continue;
            }

            try {
                const response = await this.fetch(ENDPOINTS.MEMORIES, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.request),
                });

                if (!response.ok) {
                    item.retries++;
                    this.queue.push(item);
                }
            } catch {
                item.retries++;
                this.queue.push(item);
            }
        }

        if (this.queue.length > 0) {
            Logger.info(`${this.queue.length} memories still in queue`);
        } else {
            this.stopRetryInterval();
        }
    }

    /**
     * Start retry interval for reconnection.
     */
    private startRetryInterval(): void {
        if (this.retryInterval) {
            return;
        }

        this.retryInterval = setInterval(async () => {
            const connected = await this.healthCheck();
            if (connected) {
                await this.processQueue();
            }
        }, 30000); // Retry every 30 seconds
    }

    /**
     * Stop retry interval.
     */
    private stopRetryInterval(): void {
        if (this.retryInterval) {
            clearInterval(this.retryInterval);
            this.retryInterval = null;
        }
    }

    /**
     * Fetch wrapper with proper error handling.
     */
    private async fetch(endpoint: string, options?: RequestInit): Promise<Response> {
        const url = `${this.baseUrl}${endpoint}`;

        // Use globalThis.fetch which is available in Node.js 18+ and VS Code
        // Fall back to node-fetch for older environments
        let fetchFn: typeof fetch;
        if (typeof globalThis.fetch === 'function') {
            fetchFn = globalThis.fetch;
        } else {
            // Dynamic import with type assertion
            const nodeFetch = await import('node-fetch');
            fetchFn = nodeFetch.default as unknown as typeof fetch;
        }

        // 10 second timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            return await fetchFn(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    ...options?.headers,
                },
            });
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Cleanup resources.
     */
    dispose(): void {
        this.stopRetryInterval();
    }
}
