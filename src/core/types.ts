/**
 * Core types for CodeVault extension.
 */

export type MemoryType = 'episodic' | 'semantic' | 'procedural';

export interface Memory {
    id: string;
    agent_id: string;
    type: MemoryType;
    content: string;
    importance: number;
    tags: string[];
    access_count: number;
    created_at: string;
    source?: string;
    metadata?: Record<string, unknown>;
}

export interface RecallResult {
    memories: Memory[];
    relevance_scores: number[];
    total_found: number;
    query_time_ms: number;
}

export interface CreateMemoryRequest {
    agent_id: string;
    content: string;
    type?: MemoryType;
    importance?: number;
    tags?: string[];
    metadata?: Record<string, unknown>;
    source?: string;
}

export interface SearchRequest {
    agent_id: string;
    query: string;
    top_k?: number;
    types?: MemoryType[];
    min_importance?: number;
    tags?: string[];
}

export interface HealthResponse {
    status: string;
    service: string;
    version: string;
}

export interface AgentStats {
    agent_id: string;
    total_memories: number;
    by_type: {
        episodic: number;
        semantic: number;
        procedural: number;
    };
}

export interface ProjectKnowledge {
    name: string;
    rootPath: string;
    stack: {
        languages: string[];
        frameworks: string[];
        tools: string[];
        infra: string[];
    };
    architecture: {
        structure: Record<string, string>;
        patterns: string[];
        entryPoints: string[];
    };
    conventions: {
        linting: Record<string, unknown>;
        formatting: Record<string, unknown>;
        naming: string;
    };
    decisions: string[];
    todos: Array<{ file: string; line: number; text: string }>;
    analyzedAt: Date;
}

export interface QueuedMemory {
    request: CreateMemoryRequest;
    timestamp: Date;
    retries: number;
}

export interface CaptureEvent {
    type: 'file' | 'git' | 'terminal' | 'manual';
    content: string;
    metadata: Record<string, unknown>;
    timestamp: Date;
}
