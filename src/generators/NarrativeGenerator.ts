import type {
  NarrativeContext,
  NarrativeSection,
} from '../types/index';

/**
 * NarrativeGenerator — deterministic template engine.
 * Converts raw signal data into human-readable markdown sections.
 *
 * Zero external deps. Pure string manipulation.
 * Each section is generated independently — a missing signal skips its section gracefully.
 */
export class NarrativeGenerator {
  generate(ctx: NarrativeContext): NarrativeSection[] {
    const sections: NarrativeSection[] = [];

    sections.push(this.buildHeader(ctx));

    const taskSection = this.buildTask(ctx);
    if (taskSection) sections.push(taskSection);

    const codeSection = this.buildCode(ctx);
    if (codeSection) sections.push(codeSection);

    const todosSection = this.buildTodos(ctx);
    if (todosSection) sections.push(todosSection);

    const filesSection = this.buildFiles(ctx);
    if (filesSection) sections.push(filesSection);

    sections.push(this.buildFooter(ctx));

    return sections;
  }

  // ──────────────────────────────────────────────────────────────
  // Header — summary line
  // ──────────────────────────────────────────────────────────────

  private buildHeader(ctx: NarrativeContext): NarrativeSection {
    const ts = new Date(ctx.capturedAt).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const branch = ctx.git?.branch ?? null;
    const activeFile = ctx.editor?.activeFile ?? null;

    let summary = `**${ctx.workspaceName}** — checkpoint captured ${ts}`;
    if (branch) summary += ` on branch \`${branch}\``;
    if (activeFile) summary += `, editing \`${activeFile}\``;
    summary += '.';

    return {
      id: 'header',
      title: '📍 Checkpoint',
      content: summary,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Task — what was being worked on
  // ──────────────────────────────────────────────────────────────

  private buildTask(ctx: NarrativeContext): NarrativeSection | null {
    const git = ctx.git;
    if (!git) return null;

    const lines: string[] = [];

    if (git.commitMessage) {
      lines.push(`**Last commit**: \`${git.commitHash}\` — ${git.commitMessage}`);
    }

    const changedCount =
      git.stagedFiles.length +
      git.modifiedFiles.length +
      git.untrackedFiles.length;

    if (changedCount === 0) {
      lines.push('Working tree is **clean** — no pending changes.');
    } else {
      if (git.stagedFiles.length > 0) {
        lines.push(
          `**Staged** (${git.stagedFiles.length}): ${this.fileList(git.stagedFiles)}`
        );
      }
      if (git.modifiedFiles.length > 0) {
        lines.push(
          `**Modified** (${git.modifiedFiles.length}): ${this.fileList(git.modifiedFiles)}`
        );
      }
      if (git.untrackedFiles.length > 0) {
        lines.push(
          `**Untracked** (${git.untrackedFiles.length}): ${this.fileList(git.untrackedFiles)}`
        );
      }
    }

    if (lines.length === 0) return null;

    return {
      id: 'task',
      title: '🔀 Git State',
      content: lines.join('\n'),
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Code — editor context
  // ──────────────────────────────────────────────────────────────

  private buildCode(ctx: NarrativeContext): NarrativeSection | null {
    const editor = ctx.editor;
    if (!editor || !editor.activeFile) return null;

    const lines: string[] = [];
    lines.push(`**Active file**: \`${editor.activeFile}\``);

    if (editor.cursorPosition) {
      lines.push(
        `**Cursor**: line ${editor.cursorPosition.line + 1}, col ${editor.cursorPosition.character + 1}`
      );
    }

    if (editor.visibleSymbols.length > 0) {
      lines.push(
        `**In scope**: ${editor.visibleSymbols.map((s) => `\`${s}\``).join(', ')}`
      );
    }

    if (editor.selectedText) {
      lines.push(
        `**Selected text**:\n\`\`\`\n${editor.selectedText}\n\`\`\``
      );
    }

    return {
      id: 'code',
      title: '💻 Editor Context',
      content: lines.join('\n'),
    };
  }

  // ──────────────────────────────────────────────────────────────
  // TODOs
  // ──────────────────────────────────────────────────────────────

  private buildTodos(ctx: NarrativeContext): NarrativeSection | null {
    const todos = ctx.todos;
    if (!todos || todos.items.length === 0) return null;

    const lines = todos.items.map(
      (t) => `- **${t.tag}** \`${t.file}:${t.line}\` — ${t.text}`
    );

    return {
      id: 'todos',
      title: '📋 Pending Items',
      content: lines.join('\n'),
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Recent files
  // ──────────────────────────────────────────────────────────────

  private buildFiles(ctx: NarrativeContext): NarrativeSection | null {
    const recent = ctx.recentFiles;
    if (!recent || recent.files.length === 0) return null;

    const list = recent.files.map((f) => `- \`${f}\``).join('\n');

    return {
      id: 'files',
      title: '📂 Recent Files',
      content: list,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Footer — resume hint
  // ──────────────────────────────────────────────────────────────

  private buildFooter(ctx: NarrativeContext): NarrativeSection {
    const hints: string[] = [];

    if (ctx.editor?.activeFile) {
      hints.push(`Open \`${ctx.editor.activeFile}\``);
    }

    if (ctx.git?.branch) {
      hints.push(`confirm you're on \`${ctx.git.branch}\``);
    }

    const content =
      hints.length > 0
        ? `To resume: ${hints.join(', ')}.`
        : 'Review the sections above to restore your context.';

    return {
      id: 'footer',
      title: '▶ Resume Hint',
      content,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────

  private fileList(files: string[], max = 5): string {
    const shown = files.slice(0, max).map((f) => `\`${f}\``).join(', ');
    const extra = files.length > max ? ` (+${files.length - max} more)` : '';
    return shown + extra;
  }
}
