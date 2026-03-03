import * as fs from 'fs/promises';
import * as path from 'path';
import type { TodoSignal, TodoItem, CollectorOutcome } from '../types/index';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|NOTE)\b[:\s]*(.*)/i;
const EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs',
  '.java', '.kt', '.cs', '.cpp', '.c', '.h', '.rb',
  '.php', '.swift', '.vue', '.svelte',
]);
const MAX_FILES = 20;
const MAX_TODOS = 15;

/**
 * TodoCollector — scans recently modified source files in the workspace
 * for TODO/FIXME/HACK/NOTE comments.
 *
 * Strategy:
 * 1. Walk workspace root (non-recursively at depth ≤ 3 to stay fast)
 * 2. Filter by known code file extensions
 * 3. Sort by mtime descending (most recently modified first)
 * 4. Scan up to MAX_FILES, collect up to MAX_TODOS items
 * 5. Respects 2s AbortSignal from collector orchestration
 */
export class TodoCollector {
  readonly name = 'todos';

  async collect(
    workspaceFsPath: string,
    signal?: AbortSignal
  ): Promise<CollectorOutcome<TodoSignal>> {
    const start = Date.now();

    try {
      if (signal?.aborted) {
        return { ok: false, reason: 'AbortSignal already aborted', collector: this.name };
      }

      const files = await this.findRecentFiles(workspaceFsPath);
      const items: TodoItem[] = [];

      for (const filePath of files) {
        if (signal?.aborted || Date.now() - start > 1800) break; // safety: leave 200ms margin

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const match = TODO_PATTERN.exec(lines[i]);
            if (match) {
              items.push({
                file: path.relative(workspaceFsPath, filePath),
                line: i + 1,
                tag: match[1].toUpperCase(),
                text: match[2].trim().slice(0, 120),
              });

              if (items.length >= MAX_TODOS) break;
            }
          }

          if (items.length >= MAX_TODOS) break;
        } catch {
          // Skip unreadable files
        }
      }

      return {
        ok: true,
        data: { items },
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

  private async findRecentFiles(root: string): Promise<string[]> {
    const results: Array<{ path: string; mtime: number }> = [];
    await this.walkDir(root, root, 0, results);
    results.sort((a, b) => b.mtime - a.mtime);
    return results.slice(0, MAX_FILES).map((r) => r.path);
  }

  private async walkDir(
    root: string,
    dir: string,
    depth: number,
    results: Array<{ path: string; mtime: number }>
  ): Promise<void> {
    if (depth > 3) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        // Skip common noise directories
        if (
          entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === 'out' ||
          entry.name === 'build' ||
          entry.name === '__pycache__' ||
          entry.name === 'vendor'
        ) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.walkDir(root, fullPath, depth + 1, results);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (EXTENSIONS.has(ext)) {
            try {
              const stat = await fs.stat(fullPath);
              results.push({ path: fullPath, mtime: stat.mtimeMs });
            } catch {
              // Skip stat errors
            }
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }
}
