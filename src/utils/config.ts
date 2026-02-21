/**
 * Configuration utilities for CodeVault extension.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { DEFAULT_BACKEND_URL, EXTENSION_ID } from './constants';

export interface CodeVaultConfig {
    backendUrl: string;
    autoCapture: boolean;
    autoCaptureGit: boolean;
    autoCaptureFiles: boolean;
    agentId: string;
    maxContextMemories: number;
}

/**
 * Stored agent ID override (set by "Switch Agent" command).
 * When set, this takes priority over auto-detected workspace name.
 */
let activeAgentIdOverride: string | null = null;

export function setActiveAgentId(agentId: string | null): void {
    activeAgentIdOverride = agentId;
}

export function getActiveAgentIdOverride(): string | null {
    return activeAgentIdOverride;
}

/**
 * Detect the workspace name with fallbacks:
 * 1. vscode.workspace.name (if workspace is open)
 * 2. Folder name of the active file
 * 3. 'default'
 */
function detectWorkspaceName(): string {
    // Try VS Code workspace name first
    if (vscode.workspace.name) {
        return vscode.workspace.name;
    }

    // Try workspace folders
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        return path.basename(folders[0].uri.fsPath);
    }

    // Fallback: use the folder of the active editor file
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const fileDir = path.dirname(editor.document.uri.fsPath);
        return path.basename(fileDir);
    }

    return 'default';
}

/**
 * Detect the workspace root path with fallbacks.
 */
export function detectWorkspacePath(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        return folders[0].uri.fsPath;
    }

    // Fallback: use the folder of the active editor file
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        return path.dirname(editor.document.uri.fsPath);
    }

    return '';
}

export function getConfig(): CodeVaultConfig {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);
    const workspaceName = detectWorkspaceName();

    // Priority: override > user setting > auto-detected
    const userAgentId = config.get('agentId', '');
    const agentId = activeAgentIdOverride || userAgentId || `codevault-${workspaceName}`;

    return {
        backendUrl: config.get('backendUrl', DEFAULT_BACKEND_URL),
        autoCapture: config.get('autoCapture', true),
        autoCaptureGit: config.get('autoCaptureGit', true),
        autoCaptureFiles: config.get('autoCaptureFiles', true),
        agentId,
        maxContextMemories: config.get('maxContextMemories', 10),
    };
}

export function getAgentId(): string {
    return getConfig().agentId;
}

export function getBackendUrl(): string {
    return getConfig().backendUrl;
}

export function isAutoCaptureEnabled(): boolean {
    return getConfig().autoCapture;
}
