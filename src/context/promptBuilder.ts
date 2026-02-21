/**
 * Builds prompts with memory context for AI agents.
 */

import { Memory, ProjectKnowledge } from '../core/types';

export class PromptBuilder {
    /**
     * Build a system prompt with project context.
     */
    static buildSystemPrompt(knowledge: ProjectKnowledge | null, memories: Memory[]): string {
        const parts: string[] = [];

        parts.push('You are an AI coding assistant with access to project memory.');
        parts.push('');

        if (knowledge) {
            parts.push(`## Project: ${knowledge.name}`);
            parts.push('');

            if (knowledge.stack.languages.length > 0) {
                parts.push(`**Languages:** ${knowledge.stack.languages.join(', ')}`);
            }

            if (knowledge.stack.frameworks.length > 0) {
                parts.push(`**Frameworks:** ${knowledge.stack.frameworks.join(', ')}`);
            }

            if (knowledge.architecture.patterns.length > 0) {
                parts.push(`**Architecture:** ${knowledge.architecture.patterns.join(', ')}`);
            }

            if (knowledge.conventions.naming !== 'unknown') {
                parts.push(`**Naming convention:** ${knowledge.conventions.naming}`);
            }

            parts.push('');
        }

        if (memories.length > 0) {
            parts.push('## Relevant Knowledge');
            parts.push('');

            const facts = memories.filter(m => m.type === 'semantic');
            const events = memories.filter(m => m.type === 'episodic');
            const procedures = memories.filter(m => m.type === 'procedural');

            if (facts.length > 0) {
                parts.push('**Facts:**');
                for (const m of facts.slice(0, 5)) {
                    parts.push(`- ${m.content}`);
                }
                parts.push('');
            }

            if (events.length > 0) {
                parts.push('**Recent events:**');
                for (const m of events.slice(0, 3)) {
                    parts.push(`- ${m.content}`);
                }
                parts.push('');
            }

            if (procedures.length > 0) {
                parts.push('**Known procedures:**');
                for (const m of procedures.slice(0, 3)) {
                    parts.push(`- ${m.content}`);
                }
                parts.push('');
            }
        }

        parts.push('Use this context to provide informed, project-specific assistance.');

        return parts.join('\n');
    }

    /**
     * Build a minimal context string for quick injection.
     */
    static buildMinimalContext(knowledge: ProjectKnowledge | null, memories: Memory[]): string {
        const parts: string[] = [];

        if (knowledge) {
            const stack = [...knowledge.stack.languages, ...knowledge.stack.frameworks].join(', ');
            parts.push(`Project: ${knowledge.name} (${stack})`);
        }

        if (memories.length > 0) {
            parts.push('Key points:');
            for (const m of memories.slice(0, 5)) {
                parts.push(`- ${m.content.substring(0, 100)}`);
            }
        }

        return parts.join('\n');
    }
}
