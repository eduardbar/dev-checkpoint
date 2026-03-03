import * as vscode from 'vscode';
import type {
  Checkpoint,
  NarrativeContext,
  GitSignal,
  EditorSignal,
  TodoSignal,
  RecentFilesSignal,
  TerminalSignal,
} from '../types/index';
import { GitCollector } from '../collectors/GitCollector';
import { EditorCollector } from '../collectors/EditorCollector';
import { TodoCollector } from '../collectors/TodoCollector';
import { RecentFilesCollector } from '../collectors/RecentFilesCollector';
import { TerminalCollector } from '../collectors/TerminalCollector';
import { NarrativeGenerator } from '../generators/NarrativeGenerator';
import { StorageService } from '../storage/StorageService';
import { nanoid } from '../utils/nanoid';
import { Logger } from '../utils/logger';

/**
 * CheckpointService — orchestrates the full checkpoint creation pipeline:
 * 1. Run all signal collectors in parallel (Promise.allSettled)
 * 2. Build NarrativeContext from results
 * 3. Generate narrative sections
 * 4. Persist to StorageService
 * 5. Return the created Checkpoint
 */
export class CheckpointService {
  private readonly gitCollector = new GitCollector();
  private readonly editorCollector = new EditorCollector();
  private readonly todoCollector = new TodoCollector();
  private readonly recentFilesCollector = new RecentFilesCollector();
  private readonly terminalCollector = new TerminalCollector();
  private readonly narrativeGenerator = new NarrativeGenerator();

  constructor(private readonly storage: StorageService) {}

  async capture(
    trigger: 'manual' | 'auto'
  ): Promise<Checkpoint | null> {
    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (!workspace) {
      Logger.warn('Checkpoint aborted: no workspace open');
      vscode.window.showWarningMessage(
        'Dev Checkpoint: No workspace open. Open a folder to create checkpoints.'
      );
      return null;
    }

    const workspaceFsPath = workspace.uri.fsPath;
    const workspaceName = workspace.name;
    const capturedAt = new Date().toISOString();

    Logger.info(`Capturing checkpoint (${trigger}) for ${workspaceName}`);

    // Per-collector 2-second timeout via AbortSignal
    const signal = AbortSignal.timeout(2000);

    // Run all collectors in parallel with per-collector isolation
    const [gitResult, editorResult, todoResult, recentResult, terminalResult] =
      await Promise.allSettled([
        this.gitCollector.collect(workspaceFsPath),
        this.editorCollector.collect(workspaceFsPath, signal),
        this.todoCollector.collect(workspaceFsPath, signal),
        this.recentFilesCollector.collect(workspaceFsPath, signal),
        this.terminalCollector.collect(workspaceFsPath, signal),
      ]);

    // Extract data — failed collectors return null (never crash the checkpoint)
    const git = this.unwrap<GitSignal>(gitResult, 'git');
    const editor = this.unwrap<EditorSignal>(editorResult, 'editor');
    const todos = this.unwrap<TodoSignal>(todoResult, 'todos');
    const recentFiles = this.unwrap<RecentFilesSignal>(recentResult, 'recentFiles');
    const terminal = this.unwrap<TerminalSignal>(terminalResult, 'terminal');

    const ctx: NarrativeContext = {
      git,
      editor,
      todos,
      recentFiles,
      terminal,
      capturedAt,
      workspaceName,
    };

    const narrative = this.narrativeGenerator.generate(ctx);

    const id = `${Date.now()}-${nanoid(6)}`;
    const checkpoint: Checkpoint = {
      metadata: {
        id,
        createdAt: capturedAt,
        trigger,
        workspaceFsPath,
        workspaceName,
        sizeBytes: 0, // filled by StorageService after serialization
      },
      narrative,
      signals: ctx,
    };

    try {
      await this.storage.saveCheckpoint(checkpoint);
      Logger.info(`Checkpoint ${id} created successfully`);
      return checkpoint;
    } catch (err) {
      Logger.error('Failed to save checkpoint:', err);
      vscode.window.showErrorMessage(
        `Dev Checkpoint: Failed to save checkpoint. ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }

  private unwrap<T>(
    result: PromiseSettledResult<{ ok: boolean; data?: T; reason?: string }>,
    name: string
  ): T | null {
    if (result.status === 'rejected') {
      Logger.warn(`Collector ${name} threw unexpectedly:`, result.reason);
      return null;
    }
    if (!result.value.ok) {
      Logger.warn(`Collector ${name} failed:`, result.value.reason);
      return null;
    }
    return result.value.data as T;
  }
}
