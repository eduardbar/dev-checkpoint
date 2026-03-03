import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
  CheckpointSummary,
  Checkpoint,
} from '../types/index';
import { StorageService } from '../storage/StorageService';
import { CheckpointService } from '../services/CheckpointService';
import { Logger } from '../utils/logger';

/**
 * CheckpointWebviewProvider — implements VSCode WebviewViewProvider.
 *
 * Renders the React app (out/webview.js) inside a VSCode sidebar panel.
 * Manages bidirectional message passing between extension host and webview.
 *
 * CSP: strict — `default-src 'none'; script-src 'nonce-{nonce}'`
 * The nonce is regenerated on every resolveWebviewView() call.
 */
export class CheckpointWebviewProvider
  implements vscode.WebviewViewProvider
{
  static readonly viewType = 'dev-checkpoint.history';

  private view: vscode.WebviewView | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly storage: StorageService,
    private readonly checkpointService: CheckpointService
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'out'),
      ],
    };

    const nonce = crypto.randomBytes(16).toString('hex');
    webviewView.webview.html = this.buildHtml(webviewView.webview, nonce);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(
      async (message: WebviewToExtensionMessage) => {
        await this.handleWebviewMessage(message);
      }
    );

    // Send initial data when webview signals ready
    Logger.info('Webview view resolved');
  }

  /** Push a message to the webview */
  postMessage(message: ExtensionToWebviewMessage): void {
    this.view?.webview.postMessage(message);
  }

  /** Called when a new checkpoint is created — update webview */
  async notifyCheckpointCreated(summary: CheckpointSummary): Promise<void> {
    this.postMessage({ type: 'checkpoint-created', summary });
  }

  private async handleWebviewMessage(
    message: WebviewToExtensionMessage
  ): Promise<void> {
    switch (message.type) {
      case 'ready': {
        // Send full checkpoint list on init
        const checkpoints = await this.storage.listCheckpoints();
        this.postMessage({
          type: 'init',
          checkpoints,
          activeId: null,
        });
        break;
      }

      case 'load-checkpoint': {
        const checkpoint = await this.storage.loadCheckpoint(message.id);
        if (checkpoint) {
          this.postMessage({ type: 'checkpoint-loaded', checkpoint });
        } else {
          this.postMessage({
            type: 'error',
            message: `Checkpoint ${message.id} not found`,
          });
        }
        break;
      }

      case 'delete-checkpoint': {
        await this.storage.deleteCheckpoint(message.id);
        this.postMessage({ type: 'checkpoint-deleted', id: message.id });
        break;
      }

      case 'capture-now': {
        await this.checkpointService.capture('manual');
        break;
      }
    }
  }

  private buildHtml(webview: vscode.Webview, nonce: string): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'webview.js')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';" />
  <title>Dev Checkpoint</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: var(--vscode-sideBar-background);
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    #root { width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
