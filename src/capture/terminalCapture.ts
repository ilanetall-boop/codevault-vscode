/**
 * Captures terminal commands and outputs.
 */

import * as vscode from 'vscode';
import { MemoryManager } from '../core/memoryManager';
import { Logger } from '../utils/logger';

export class TerminalCapture {
    private memoryManager: MemoryManager;
    private disposables: vscode.Disposable[] = [];

    constructor(memoryManager: MemoryManager) {
        this.memoryManager = memoryManager;
    }

    /**
     * Start monitoring terminal.
     */
    start(context: vscode.ExtensionContext): void {
        // Monitor terminal creation
        const terminalCreated = vscode.window.onDidOpenTerminal(terminal => {
            Logger.debug(`Terminal opened: ${terminal.name}`);
        });

        // Monitor terminal close
        const terminalClosed = vscode.window.onDidCloseTerminal(terminal => {
            Logger.debug(`Terminal closed: ${terminal.name}`);
        });

        this.disposables.push(terminalCreated, terminalClosed);
        context.subscriptions.push(...this.disposables);

        // Note: VS Code API doesn't provide direct access to terminal input/output
        // We can only monitor terminal lifecycle events
        // For full terminal capture, we'd need to use a different approach
        // (e.g., shell integration or a separate terminal emulator)

        Logger.info('Terminal capture initialized (limited mode)');
    }

    /**
     * Stop monitoring.
     */
    stop(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }

    /**
     * Manually capture a terminal command.
     * Called when user explicitly wants to remember a command.
     */
    async captureCommand(command: string, output?: string): Promise<void> {
        const content = output
            ? `Command: ${command}\nOutput: ${output.substring(0, 500)}`
            : `Command: ${command}`;

        await this.memoryManager.remember(content, 'procedural', {
            importance: 0.7,
            tags: ['terminal', 'command'],
            source: 'terminal-capture',
            metadata: { command },
        });

        Logger.info(`Captured terminal command: ${command}`);
    }
}
