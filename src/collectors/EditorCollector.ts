import * as vscode from 'vscode';
import * as path from 'path';
import type { EditorSignal, CollectorOutcome } from '../types/index';

/**
 * EditorCollector — captures current editor state via VSCode API.
 * Pure VSCode API calls — no CLI, no timeout needed (synchronous reads).
 *
 * Captures:
 * - Active file (relative path)
 * - Cursor position
 * - Open files (max 10, relative paths)
 * - Selected text (max 200 chars)
 * - Visible symbols near cursor (via DocumentSymbol provider)
 */
export class EditorCollector {
  readonly name = 'editor';

  async collect(
    workspaceFsPath: string,
    signal?: AbortSignal
  ): Promise<CollectorOutcome<EditorSignal>> {
    const start = Date.now();

    try {
      if (signal?.aborted) {
        return { ok: false, reason: 'AbortSignal already aborted', collector: this.name };
      }

      const editor = vscode.window.activeTextEditor;

      const activeFile = editor
        ? path.relative(workspaceFsPath, editor.document.uri.fsPath)
        : null;

      const cursorPosition = editor
        ? {
            line: editor.selection.active.line,
            character: editor.selection.active.character,
          }
        : null;

      const openFiles = vscode.workspace.textDocuments
        .filter((doc) => !doc.isUntitled && doc.uri.scheme === 'file')
        .slice(0, 10)
        .map((doc) => path.relative(workspaceFsPath, doc.uri.fsPath));

      const selectedText = editor
        ? editor.document
            .getText(editor.selection)
            .slice(0, 200)
            .trim() || null
        : null;

      const visibleSymbols = await this.getNearbySymbols(editor);

      return {
        ok: true,
        data: {
          activeFile,
          cursorPosition,
          openFiles,
          selectedText,
          visibleSymbols,
        },
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

  private async getNearbySymbols(
    editor: vscode.TextEditor | undefined
  ): Promise<string[]> {
    if (!editor) return [];

    try {
      const symbols = await vscode.commands.executeCommand<
        vscode.DocumentSymbol[]
      >('vscode.executeDocumentSymbolProvider', editor.document.uri);

      if (!symbols) return [];

      const cursorLine = editor.selection.active.line;
      const nearby: string[] = [];

      const flatten = (syms: vscode.DocumentSymbol[], depth = 0): void => {
        for (const sym of syms) {
          if (depth <= 2 && sym.range.contains(new vscode.Position(cursorLine, 0))) {
            nearby.push(sym.name);
          }
          if (sym.children) flatten(sym.children, depth + 1);
        }
      };

      flatten(symbols);
      return nearby.slice(0, 5);
    } catch {
      return [];
    }
  }
}
