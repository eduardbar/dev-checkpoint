import * as vscode from 'vscode';

/**
 * Centralised output channel logger.
 * Wraps VSCode OutputChannel so all messages are visible in the
 * "Dev Checkpoint" output panel. Log levels: info, warn, error.
 * Call Logger.init() once from extension activate() before use.
 */
export class Logger {
  private static channel: vscode.OutputChannel | null = null;

  static init(context: vscode.ExtensionContext): void {
    Logger.channel = vscode.window.createOutputChannel('Dev Checkpoint');
    context.subscriptions.push(Logger.channel);
  }

  static info(message: string, ...args: unknown[]): void {
    Logger.write('INFO', message, args);
  }

  static warn(message: string, ...args: unknown[]): void {
    Logger.write('WARN', message, args);
  }

  static error(message: string, ...args: unknown[]): void {
    Logger.write('ERROR', message, args);
  }

  private static write(
    level: string,
    message: string,
    args: unknown[]
  ): void {
    const timestamp = new Date().toISOString();
    const extras = args.length > 0 ? ' ' + args.map(String).join(' ') : '';
    const line = `[${timestamp}] [${level}] ${message}${extras}`;

    if (Logger.channel) {
      Logger.channel.appendLine(line);
    } else {
      // Fallback before init — use console so we never lose messages
      console.log(line);
    }
  }

  /** Dispose the output channel — called from extension deactivate() */
  static dispose(): void {
    Logger.channel?.dispose();
    Logger.channel = null;
  }
}
