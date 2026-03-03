import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

/**
 * IdleDetectionService — monitors editor activity and fires an event
 * when the user has been idle for `idleThresholdMs` milliseconds.
 *
 * Detection signals (any of these resets the idle timer):
 * - Text document changes
 * - Active editor changes
 * - Terminal focus changes
 * - Selection changes in visible editors
 *
 * Suppression logic:
 * - If the same file+position triggered the last auto-checkpoint, skip
 * - Prevents double-firing if user just reads without typing
 */
export class IdleDetectionService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastCheckpointEditorState: string | null = null;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly onIdleEmitter = new vscode.EventEmitter<void>();

  /** Fires when idle threshold is exceeded */
  readonly onIdle = this.onIdleEmitter.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  start(): void {
    const config = vscode.workspace.getConfiguration('devCheckpoint');
    const autoEnabled: boolean = config.get('autoCheckpoint', true);

    if (!autoEnabled) {
      Logger.info('Idle detection disabled via config');
      return;
    }

    Logger.info('Idle detection started');

    // Register activity listeners
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(() => this.resetTimer()),
      vscode.window.onDidChangeActiveTextEditor(() => this.resetTimer()),
      vscode.window.onDidChangeTextEditorSelection(() => this.resetTimer()),
      vscode.window.onDidChangeTerminalState(() => this.resetTimer())
    );

    this.resetTimer();
  }

  stop(): void {
    this.clearTimer();
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
    this.onIdleEmitter.dispose();
    Logger.info('Idle detection stopped');
  }

  /** Call after a checkpoint is created to update suppression state */
  recordCheckpoint(): void {
    this.lastCheckpointEditorState = this.currentEditorState();
  }

  private resetTimer(): void {
    this.clearTimer();

    const config = vscode.workspace.getConfiguration('devCheckpoint');
    const thresholdMin: number = config.get('idleThresholdMinutes', 5);
    const thresholdMs = thresholdMin * 60 * 1000;

    this.timer = setTimeout(() => {
      this.onIdleTimeout();
    }, thresholdMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private onIdleTimeout(): void {
    const currentState = this.currentEditorState();

    // Suppress if nothing changed since last auto-checkpoint
    if (
      this.lastCheckpointEditorState !== null &&
      this.lastCheckpointEditorState === currentState
    ) {
      Logger.info('Idle fired but editor state unchanged — suppressed');
      return;
    }

    Logger.info('Idle threshold exceeded — firing checkpoint');
    this.onIdleEmitter.fire();
  }

  private currentEditorState(): string {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return '__no_editor__';

    const file = editor.document.uri.fsPath;
    const pos = editor.selection.active;
    return `${file}:${pos.line}:${pos.character}`;
  }
}
