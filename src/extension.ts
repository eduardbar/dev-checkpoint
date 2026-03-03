import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { StorageService } from './storage/StorageService';
import { CheckpointService } from './services/CheckpointService';
import { IdleDetectionService } from './services/IdleDetectionService';
import { CheckpointWebviewProvider } from './webview/CheckpointWebviewProvider';

// Module-level reference so deactivate() can stop the service
let idleDetectionService: IdleDetectionService | null = null;

/**
 * Extension entry point — called once by VSCode on activation.
 *
 * Wiring order:
 * 1. Logger (needed by everything else)
 * 2. StorageService (needs globalStorageUri + workspace)
 * 3. CheckpointService (needs StorageService)
 * 4. IdleDetectionService (needs CheckpointService)
 * 5. WebviewProvider (needs StorageService + CheckpointService)
 * 6. Command registrations
 */
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  Logger.init(context);
  Logger.info('Dev Checkpoint activating...');

  const workspace = vscode.workspace.workspaceFolders?.[0];

  // StorageService — workspace-scoped
  const storageService = new StorageService(
    context.globalStorageUri.fsPath,
    workspace?.uri.fsPath ?? ''
  );

  if (workspace) {
    await storageService.ensureDirectory();
  }

  // Core services
  const checkpointService = new CheckpointService(storageService);

  // Webview provider
  const webviewProvider = new CheckpointWebviewProvider(
    context.extensionUri,
    storageService,
    checkpointService
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      CheckpointWebviewProvider.viewType,
      webviewProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Idle detection — only if workspace is open
  if (workspace) {
    idleDetectionService = new IdleDetectionService(context);

    idleDetectionService.onIdle(async () => {
      const checkpoint = await checkpointService.capture('auto');
      if (checkpoint) {
        idleDetectionService!.recordCheckpoint();
        // Read sizeBytes from the saved index entry (filled by StorageService)
        const summaries = await storageService.listCheckpoints();
        const saved = summaries.find((s) => s.id === checkpoint.metadata.id);
        await webviewProvider.notifyCheckpointCreated({
          id: checkpoint.metadata.id,
          createdAt: checkpoint.metadata.createdAt,
          trigger: checkpoint.metadata.trigger,
          workspaceName: checkpoint.metadata.workspaceName,
          preview: checkpoint.narrative[0]?.content.slice(0, 80) ?? '',
          sizeBytes: saved?.sizeBytes ?? 0,
        });
      }
    });

    idleDetectionService.start();
  }

  // ──────────────────────────────────────────────────────────────
  // Commands
  // ──────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'dev-checkpoint.capture',
      async () => {
        if (!workspace) {
          vscode.window.showWarningMessage(
            'Dev Checkpoint: Open a folder first to create a checkpoint.'
          );
          return;
        }

        const checkpoint = await checkpointService.capture('manual');
        if (checkpoint) {
          vscode.window.showInformationMessage(
            `Dev Checkpoint: Context captured! (${new Date(checkpoint.metadata.createdAt).toLocaleTimeString()})`
          );

          // Read sizeBytes from the saved index entry (filled by StorageService)
          const summaries = await storageService.listCheckpoints();
          const saved = summaries.find((s) => s.id === checkpoint.metadata.id);
          await webviewProvider.notifyCheckpointCreated({
            id: checkpoint.metadata.id,
            createdAt: checkpoint.metadata.createdAt,
            trigger: checkpoint.metadata.trigger,
            workspaceName: checkpoint.metadata.workspaceName,
            preview: checkpoint.narrative[0]?.content.slice(0, 80) ?? '',
            sizeBytes: saved?.sizeBytes ?? 0,
          });

          idleDetectionService?.recordCheckpoint();
        }
      }
    ),

    vscode.commands.registerCommand(
      'dev-checkpoint.showHistory',
      async () => {
        await vscode.commands.executeCommand(
          'workbench.view.explorer'
        );
        await vscode.commands.executeCommand(
          `${CheckpointWebviewProvider.viewType}.focus`
        );
      }
    ),

    vscode.commands.registerCommand(
      'dev-checkpoint.restore',
      async () => {
        const checkpoints = await storageService.listCheckpoints();
        if (checkpoints.length === 0) {
          vscode.window.showInformationMessage(
            'Dev Checkpoint: No checkpoints found for this workspace.'
          );
          return;
        }

        // Quick pick — show last 10 checkpoints
        const items = checkpoints.slice(0, 10).map((c) => ({
          label: new Date(c.createdAt).toLocaleString(),
          description: `${c.trigger} — ${c.preview.slice(0, 60)}`,
          id: c.id,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a checkpoint to restore',
        });

        if (selected) {
          const checkpoint = await storageService.loadCheckpoint(selected.id);
          if (checkpoint) {
            // Show checkpoint content in a new untitled document
            const content = checkpoint.narrative
              .map((s) => `## ${s.title}\n\n${s.content}`)
              .join('\n\n---\n\n');

            const doc = await vscode.workspace.openTextDocument({
              content,
              language: 'markdown',
            });
            await vscode.window.showTextDocument(doc, { preview: true });
          }
        }
      }
    )
  );

  Logger.info('Dev Checkpoint activated');
}

export function deactivate(): void {
  Logger.info('Dev Checkpoint deactivating');
  idleDetectionService?.stop();
  idleDetectionService = null;
  Logger.dispose();
}
