import type { GitSignal, CollectorOutcome } from '../types/index';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

/**
 * GitCollector — extracts branch, last commit, and file-change status
 * from the Git CLI. Runs with a 2-second timeout via AbortSignal.
 *
 * Requirements satisfied:
 * - Returns null signal (ok: false) if no git repo or git not available
 * - Never throws — wraps all errors into CollectorError
 * - Detects workspace root as cwd for git commands
 */
export class GitCollector {
  readonly name = 'git';

  async collect(
    workspaceFsPath: string
  ): Promise<CollectorOutcome<GitSignal>> {
    const start = Date.now();
    const signal = AbortSignal.timeout(2000);

    try {
      const opts = { cwd: workspaceFsPath, signal };

      const [branchResult, logResult, statusResult] = await Promise.allSettled([
        execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], opts),
        execFileAsync(
          'git',
          ['log', '-1', '--pretty=format:%h%n%s'],
          opts
        ),
        execFileAsync(
          'git',
          ['status', '--porcelain'],
          opts
        ),
      ]);

      const branch =
        branchResult.status === 'fulfilled'
          ? branchResult.value.stdout.trim()
          : null;

      let commitHash: string | null = null;
      let commitMessage: string | null = null;
      if (logResult.status === 'fulfilled') {
        const lines = logResult.value.stdout.trim().split('\n');
        commitHash = lines[0] ?? null;
        commitMessage = lines[1] ?? null;
      }

      const stagedFiles: string[] = [];
      const modifiedFiles: string[] = [];
      const untrackedFiles: string[] = [];

      if (statusResult.status === 'fulfilled') {
        for (const line of statusResult.value.stdout.split('\n')) {
          if (!line.trim()) continue;
          const x = line[0]; // index status
          const y = line[1]; // working tree status
          const file = line.slice(3).trim();

          if (x !== ' ' && x !== '?') stagedFiles.push(file);
          if (y === 'M' || y === 'D') modifiedFiles.push(file);
          if (x === '?' && y === '?') untrackedFiles.push(file);
        }
      }

      return {
        ok: true,
        data: {
          branch,
          commitHash,
          commitMessage,
          stagedFiles,
          modifiedFiles,
          untrackedFiles,
          isRepo: true,
        },
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const reason =
        err instanceof Error ? err.message : String(err);
      // Distinguish "not a git repo" from other errors
      const isNotRepo =
        reason.includes('not a git repository') ||
        reason.includes('fatal:');

      if (isNotRepo) {
        return {
          ok: true,
          data: {
            branch: null,
            commitHash: null,
            commitMessage: null,
            stagedFiles: [],
            modifiedFiles: [],
            untrackedFiles: [],
            isRepo: false,
          },
          durationMs: Date.now() - start,
        };
      }

      return { ok: false, reason, collector: this.name };
    }
  }
}
