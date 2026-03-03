import * as vscode from 'vscode';
import * as path from 'path';
import type { RecentFilesSignal, CollectorOutcome } from '../types/index';

/**
 * RecentFilesCollector — returns recently modified open files via VSCode API.
 * Uses `vscode.workspace.textDocuments` filtered and sorted by document order
 * (VSCode maintains tab recency order internally).
 *
 * Max 5 files returned, relative to workspace root.
 */
export class RecentFilesCollector {
  readonly name = 'recentFiles';

  async collect(
    workspaceFsPath: string,
    signal?: AbortSignal
  ): Promise<CollectorOutcome<RecentFilesSignal>> {
    const start = Date.now();

    try {
      if (signal?.aborted) {
        return { ok: false, reason: 'AbortSignal already aborted', collector: this.name };
      }

      const docs = vscode.workspace.textDocuments
        .filter(
          (doc) =>
            !doc.isUntitled &&
            doc.uri.scheme === 'file' &&
            !doc.uri.fsPath.includes('node_modules')
        )
        .slice(0, 5)
        .map((doc) => path.relative(workspaceFsPath, doc.uri.fsPath));

      return {
        ok: true,
        data: { files: docs },
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
        collector: this.name,
      };
    }
  }
}
