/**
 * Logger utility for CodeVault extension.
 */

import * as vscode from 'vscode';
import { EXTENSION_NAME } from './constants';

let outputChannel: vscode.OutputChannel | undefined;

export class Logger {
    private static channel: vscode.OutputChannel;

    static init(context: vscode.ExtensionContext): void {
        this.channel = vscode.window.createOutputChannel(EXTENSION_NAME);
        context.subscriptions.push(this.channel);
        outputChannel = this.channel;
    }

    static info(message: string, ...args: unknown[]): void {
        this.log('INFO', message, ...args);
    }

    static warn(message: string, ...args: unknown[]): void {
        this.log('WARN', message, ...args);
    }

    static error(message: string, ...args: unknown[]): void {
        this.log('ERROR', message, ...args);
    }

    static debug(message: string, ...args: unknown[]): void {
        this.log('DEBUG', message, ...args);
    }

    private static log(level: string, message: string, ...args: unknown[]): void {
        const timestamp = new Date().toISOString();
        const formattedMessage = args.length > 0
            ? `${message} ${args.map(a => JSON.stringify(a)).join(' ')}`
            : message;

        const logLine = `[${timestamp}] [${level}] ${formattedMessage}`;

        if (this.channel) {
            this.channel.appendLine(logLine);
        }

        // Also log to console for development
        if (level === 'ERROR') {
            console.error(logLine);
        } else if (level === 'WARN') {
            console.warn(logLine);
        } else {
            console.log(logLine);
        }
    }

    static show(): void {
        if (this.channel) {
            this.channel.show();
        }
    }
}

export function getOutputChannel(): vscode.OutputChannel | undefined {
    return outputChannel;
}
