import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { TerminalSignal, CollectorOutcome } from '../types/index';

type ShellType = TerminalSignal['shellType'];

/**
 * TerminalCollector — reads shell history from known file locations.
 * Best-effort: returns empty on failure, never throws.
 *
 * Strategy per platform:
 * - Linux/macOS: Read ~/.bash_history, ~/.zsh_history, ~/.local/share/fish/fish_history
 * - Windows: Read PowerShell PSReadLine history at:
 *   %APPDATA%\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt
 *
 * Returns last 10 non-empty, non-duplicate lines.
 */
export class TerminalCollector {
  readonly name = 'terminal';

  async collect(
    _workspaceFsPath: string,
    signal?: AbortSignal
  ): Promise<CollectorOutcome<TerminalSignal>> {
    const start = Date.now();

    try {
      if (signal?.aborted) {
        return { ok: false, reason: 'AbortSignal already aborted', collector: this.name };
      }

      const platform = process.platform;
      const homeDir = os.homedir();

      const candidates = this.getHistoryCandidates(platform, homeDir);

      for (const { filePath, shell } of candidates) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = this.parseHistoryLines(content, shell);

          if (lines.length > 0) {
            return {
              ok: true,
              data: { lastOutput: lines, shellType: shell },
              durationMs: Date.now() - start,
            };
          }
        } catch {
          continue;
        }
      }

      // No history found — return empty but ok
      return {
        ok: true,
        data: { lastOutput: [], shellType: 'unknown' },
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

  private getHistoryCandidates(
    platform: string,
    homeDir: string
  ): Array<{ filePath: string; shell: ShellType }> {
    if (platform === 'win32') {
      return [
        {
          filePath: path.join(
            homeDir,
            'AppData',
            'Roaming',
            'Microsoft',
            'Windows',
            'PowerShell',
            'PSReadLine',
            'ConsoleHost_history.txt'
          ),
          shell: 'powershell' as ShellType,
        },
      ];
    }

    return [
      { filePath: path.join(homeDir, '.zsh_history'), shell: 'zsh' as ShellType },
      { filePath: path.join(homeDir, '.bash_history'), shell: 'bash' as ShellType },
      {
        filePath: path.join(
          homeDir,
          '.local',
          'share',
          'fish',
          'fish_history'
        ),
        shell: 'fish' as ShellType,
      },
    ];
  }

  private parseHistoryLines(
    content: string,
    shell: ShellType
  ): string[] {
    let lines: string[];

    if (shell === 'zsh') {
      // zsh extended history: `: 1234567890:0;command`
      lines = content
        .split('\n')
        .map((l) => l.replace(/^: \d+:\d+;/, '').trim())
        .filter(Boolean);
    } else if (shell === 'fish') {
      // fish history YAML: `- cmd: command\n  when: 1234567890`
      lines = content
        .split('\n')
        .filter((l) => l.startsWith('- cmd:'))
        .map((l) => l.replace(/^- cmd:\s*/, '').trim());
    } else {
      lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
    }

    // Deduplicate and take last 10
    const unique: string[] = [];
    const seen = new Set<string>();
    for (let i = lines.length - 1; i >= 0 && unique.length < 10; i--) {
      if (!seen.has(lines[i])) {
        seen.add(lines[i]);
        unique.unshift(lines[i]);
      }
    }

    return unique;
  }
}
