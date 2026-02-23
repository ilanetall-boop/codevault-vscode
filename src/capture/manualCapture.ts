/**
 * Manual memory capture from user selections.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { MemoryManager } from '../core/memoryManager';
import { MemoryType } from '../core/types';
import { Logger } from '../utils/logger';

export class ManualCapture {
    private memoryManager: MemoryManager;

    constructor(memoryManager: MemoryManager) {
        this.memoryManager = memoryManager;
    }

    /**
     * Capture the current selection or line.
     */
    async captureSelection(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }

        const selection = editor.selection;
        const document = editor.document;

        // Get selected text or current line
        let text: string;
        let lineInfo: string;

        if (selection.isEmpty) {
            // No selection, use current line
            const line = document.lineAt(selection.active.line);
            text = line.text.trim();
            lineInfo = `Line ${selection.active.line + 1}`;
        } else {
            text = document.getText(selection).trim();
            lineInfo = selection.isSingleLine
                ? `Line ${selection.start.line + 1}`
                : `Lines ${selection.start.line + 1}-${selection.end.line + 1}`;
        }

        if (!text) {
            vscode.window.showWarningMessage('Nothing to remember');
            return;
        }

        // Ask for optional note
        const note = await vscode.window.showInputBox({
            prompt: 'Add a note (optional)',
            placeHolder: 'What should I remember about this?',
        });

        // Ask for memory type
        const typeChoice = await vscode.window.showQuickPick(
            [
                { label: '💡 Semantic', description: 'A fact or piece of knowledge', value: 'semantic' as MemoryType },
                { label: '📅 Episodic', description: 'An event or experience', value: 'episodic' as MemoryType },
                { label: '📋 Procedural', description: 'A how-to or procedure', value: 'procedural' as MemoryType },
            ],
            { placeHolder: 'What type of memory is this?' }
        );

        if (!typeChoice) {
            return; // User cancelled
        }

        // Build memory content
        const fileName = path.basename(document.fileName);
        const relativePath = vscode.workspace.asRelativePath(document.uri);
        const language = document.languageId;

        let content: string;
        if (note) {
            content = `${note}\n\nCode (${fileName}, ${lineInfo}):\n\`\`\`${language}\n${text}\n\`\`\``;
        } else {
            content = `Code from ${fileName} (${lineInfo}):\n\`\`\`${language}\n${text}\n\`\`\``;
        }

        // Store the memory
        const memory = await this.memoryManager.remember(content, typeChoice.value, {
            importance: 0.7,
            tags: ['manual', language, 'code'],
            source: 'manual-capture',
            metadata: {
                file: relativePath,
                line: selection.start.line + 1,
                language,
            },
        });

        if (memory) {
            vscode.window.showInformationMessage(`Remembered! (${typeChoice.label})`);
            Logger.info(`Manual capture: ${typeChoice.value} - ${fileName}:${lineInfo}`);
        } else {
            vscode.window.showInformationMessage('Memory queued (backend offline)');
        }
    }

}
