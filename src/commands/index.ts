/**
 * Command registration for CodeVault extension.
 */

import * as vscode from 'vscode';
import { MemoryManager } from '../core/memoryManager';
import { ProjectAnalyzer } from '../core/projectAnalyzer';
import { MemoryTreeProvider } from '../ui/memoryTreeProvider';
import { ManualCapture } from '../capture/manualCapture';
import { ContextInjector } from '../context/contextInjector';
import { Logger } from '../utils/logger';
import { getAgentId, setActiveAgentId } from '../utils/config';
import * as path from 'path';

export function registerCommands(
    context: vscode.ExtensionContext,
    memoryManager: MemoryManager,
    analyzer: ProjectAnalyzer,
    treeProvider: MemoryTreeProvider
): void {
    const manualCapture = new ManualCapture(memoryManager);
    const contextInjector = new ContextInjector(memoryManager, analyzer);

    // Remember command
    const rememberCmd = vscode.commands.registerCommand('codevault.remember', async () => {
        await manualCapture.captureSelection();
        treeProvider.refresh();
    });

    // Recall command
    const recallCmd = vscode.commands.registerCommand('codevault.recall', async () => {
        const query = await vscode.window.showInputBox({
            prompt: 'What do you want to recall?',
            placeHolder: 'Search memories...',
        });

        if (!query) {return;}

        const result = await memoryManager.recall(query);

        if (result.memories.length === 0) {
            vscode.window.showInformationMessage('No memories found');
            return;
        }

        // Show results in quick pick
        const items = result.memories.map((mem, i) => ({
            label: `[${mem.type}] ${mem.content.substring(0, 60)}...`,
            description: `Score: ${result.relevance_scores[i].toFixed(2)}`,
            detail: mem.content,
            memory: mem,
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `Found ${result.total_found} memories`,
            matchOnDescription: true,
            matchOnDetail: true,
        });

        if (selected) {
            // Copy selected memory to clipboard
            await vscode.env.clipboard.writeText(selected.memory.content);
            vscode.window.showInformationMessage('Memory copied to clipboard');
        }
    });

    // Forget command
    const forgetCmd = vscode.commands.registerCommand('codevault.forget', async (memoryId?: string) => {
        if (!memoryId) {
            // Show list of memories to forget
            const memories = await memoryManager.getAllMemories(50);
            if (memories.length === 0) {
                vscode.window.showInformationMessage('No memories to forget');
                return;
            }

            const items = memories.map(mem => ({
                label: `[${mem.type}] ${mem.content.substring(0, 50)}...`,
                description: new Date(mem.created_at).toLocaleDateString(),
                memoryId: mem.id,
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select memory to forget',
            });

            if (selected) {
                memoryId = selected.memoryId;
            }
        }

        if (memoryId) {
            const confirmed = await vscode.window.showWarningMessage(
                'Are you sure you want to forget this memory?',
                'Yes', 'No'
            );

            if (confirmed === 'Yes') {
                await memoryManager.forget(memoryId);
                treeProvider.refresh();
                vscode.window.showInformationMessage('Memory forgotten');
            }
        }
    });

    // Show memories command
    const showMemoriesCmd = vscode.commands.registerCommand('codevault.showMemories', async () => {
        // Focus on the sidebar
        await vscode.commands.executeCommand('codevault-memories.focus');
    });

    // Export context command
    const exportContextCmd = vscode.commands.registerCommand('codevault.exportContext', async () => {
        await contextInjector.exportToClipboard();
    });

    // Analyze project command
    const analyzeProjectCmd = vscode.commands.registerCommand('codevault.analyzeProject', async () => {
        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analyzing project...',
                cancellable: false,
            }, async () => {
                const knowledge = await analyzer.analyzeWorkspace();
                await memoryManager.storeProjectKnowledge(knowledge);
                treeProvider.refresh();
            });

            vscode.window.showInformationMessage('Project analysis complete!');
        } catch (error) {
            Logger.error('Project analysis failed:', error);
            vscode.window.showErrorMessage('Failed to analyze project');
        }
    });

    // Start backend command
    const startBackendCmd = vscode.commands.registerCommand('codevault.startBackend', async () => {
        const terminal = vscode.window.createTerminal('CodeVault Backend');

        // Determine the script to run based on platform
        const isWindows = process.platform === 'win32';
        const scriptPath = path.join(context.extensionPath, 'scripts', isWindows ? 'start-backend.bat' : 'start-backend.sh');

        terminal.sendText(isWindows ? `"${scriptPath}"` : `bash "${scriptPath}"`);
        terminal.show();

        // Wait a bit and check connection
        setTimeout(async () => {
            const connected = await memoryManager.healthCheck();
            if (connected) {
                vscode.window.showInformationMessage('CodeVault backend started!');
            }
        }, 3000);
    });

    // Refresh memories command
    const refreshCmd = vscode.commands.registerCommand('codevault.refreshMemories', () => {
        treeProvider.refresh();
    });

    // Switch Agent command
    const switchAgentCmd = vscode.commands.registerCommand('codevault.switchAgent', async () => {
        const agents = await memoryManager.listAgents();

        if (agents.length === 0) {
            vscode.window.showInformationMessage('No agents found in backend. Store some memories first.');
            return;
        }

        const currentAgentId = getAgentId();
        const items = agents.map(a => ({
            label: a.agent_id,
            description: `${a.memory_count} memories${a.agent_id === currentAgentId ? ' (current)' : ''}`,
            agentId: a.agent_id,
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `Current agent: ${currentAgentId} — Select agent to switch to`,
        });

        if (selected) {
            setActiveAgentId(selected.agentId);
            treeProvider.refresh();
            vscode.window.showInformationMessage(`Switched to agent: ${selected.agentId}`);
            Logger.info(`[SwitchAgent] Switched active agent to: ${selected.agentId}`);
        }
    });

    // Register all commands
    context.subscriptions.push(
        rememberCmd,
        recallCmd,
        forgetCmd,
        showMemoriesCmd,
        exportContextCmd,
        analyzeProjectCmd,
        startBackendCmd,
        refreshCmd,
        switchAgentCmd
    );

    Logger.info('Commands registered');
}
