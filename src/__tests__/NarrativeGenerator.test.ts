import { describe, it, expect } from 'vitest';
import { NarrativeGenerator } from '../generators/NarrativeGenerator';
import type { NarrativeContext, GitSignal, EditorSignal, TodoSignal, RecentFilesSignal } from '../types/index';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CAPTURED_AT = '2026-03-03T12:00:00.000Z';

function makeGit(partial: Partial<GitSignal> = {}): GitSignal {
  return {
    branch: 'main',
    commitHash: 'abc1234',
    commitMessage: 'feat: add narrative generator',
    stagedFiles: ['src/generators/NarrativeGenerator.ts'],
    modifiedFiles: ['src/extension.ts'],
    untrackedFiles: [],
    isRepo: true,
    ...partial,
  };
}

function makeEditor(partial: Partial<EditorSignal> = {}): EditorSignal {
  return {
    activeFile: 'src/extension.ts',
    cursorPosition: { line: 42, character: 10 },
    openFiles: ['src/extension.ts', 'src/services/CheckpointService.ts'],
    selectedText: null,
    visibleSymbols: ['activate', 'deactivate'],
    ...partial,
  };
}

function makeTodos(): TodoSignal {
  return {
    items: [
      { file: 'src/extension.ts', line: 10, tag: 'TODO', text: 'refactor this' },
      { file: 'src/storage/StorageService.ts', line: 99, tag: 'FIXME', text: 'handle edge case' },
    ],
  };
}

function makeRecentFiles(): RecentFilesSignal {
  return { files: ['src/extension.ts', 'src/collectors/GitCollector.ts'] };
}

function makeFullContext(): NarrativeContext {
  return {
    capturedAt: CAPTURED_AT,
    workspaceName: 'dev-checkpoint',
    git: makeGit(),
    editor: makeEditor(),
    todos: makeTodos(),
    recentFiles: makeRecentFiles(),
    terminal: null,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NarrativeGenerator', () => {
  const gen = new NarrativeGenerator();

  describe('generate() — full signals', () => {
    it('returns at least 3 sections (header + at least one content + footer)', () => {
      const sections = gen.generate(makeFullContext());
      expect(sections.length).toBeGreaterThanOrEqual(3);
    });

    it('always starts with header section', () => {
      const sections = gen.generate(makeFullContext());
      expect(sections[0].id).toBe('header');
    });

    it('always ends with footer section', () => {
      const sections = gen.generate(makeFullContext());
      expect(sections[sections.length - 1].id).toBe('footer');
    });

    it('header contains workspace name', () => {
      const sections = gen.generate(makeFullContext());
      const header = sections.find((s) => s.id === 'header')!;
      expect(header.content).toContain('dev-checkpoint');
    });

    it('header contains branch name', () => {
      const sections = gen.generate(makeFullContext());
      const header = sections.find((s) => s.id === 'header')!;
      expect(header.content).toContain('main');
    });

    it('header contains active file', () => {
      const sections = gen.generate(makeFullContext());
      const header = sections.find((s) => s.id === 'header')!;
      expect(header.content).toContain('src/extension.ts');
    });

    it('includes task/git section when git signal is present', () => {
      const sections = gen.generate(makeFullContext());
      const task = sections.find((s) => s.id === 'task');
      expect(task).toBeDefined();
    });

    it('git section contains commit hash and message', () => {
      const sections = gen.generate(makeFullContext());
      const task = sections.find((s) => s.id === 'task')!;
      expect(task.content).toContain('abc1234');
      expect(task.content).toContain('feat: add narrative generator');
    });

    it('git section shows staged files', () => {
      const sections = gen.generate(makeFullContext());
      const task = sections.find((s) => s.id === 'task')!;
      expect(task.content).toContain('Staged');
      expect(task.content).toContain('NarrativeGenerator.ts');
    });

    it('includes code/editor section when editor signal is present', () => {
      const sections = gen.generate(makeFullContext());
      const code = sections.find((s) => s.id === 'code');
      expect(code).toBeDefined();
    });

    it('editor section shows cursor position (1-indexed)', () => {
      const sections = gen.generate(makeFullContext());
      const code = sections.find((s) => s.id === 'code')!;
      // line 42 (0-indexed) → displayed as 43
      expect(code.content).toContain('43');
    });

    it('editor section shows visible symbols', () => {
      const sections = gen.generate(makeFullContext());
      const code = sections.find((s) => s.id === 'code')!;
      expect(code.content).toContain('activate');
    });

    it('includes todos section when todos are present', () => {
      const sections = gen.generate(makeFullContext());
      const todos = sections.find((s) => s.id === 'todos');
      expect(todos).toBeDefined();
    });

    it('todos section lists each item with tag and text', () => {
      const sections = gen.generate(makeFullContext());
      const todos = sections.find((s) => s.id === 'todos')!;
      expect(todos.content).toContain('TODO');
      expect(todos.content).toContain('refactor this');
      expect(todos.content).toContain('FIXME');
      expect(todos.content).toContain('handle edge case');
    });

    it('includes recent files section when recentFiles signal is present', () => {
      const sections = gen.generate(makeFullContext());
      const files = sections.find((s) => s.id === 'files');
      expect(files).toBeDefined();
    });

    it('footer contains resume hint with active file', () => {
      const sections = gen.generate(makeFullContext());
      const footer = sections.find((s) => s.id === 'footer')!;
      expect(footer.content).toContain('src/extension.ts');
    });

    it('footer contains branch in resume hint', () => {
      const sections = gen.generate(makeFullContext());
      const footer = sections.find((s) => s.id === 'footer')!;
      expect(footer.content).toContain('main');
    });
  });

  describe('generate() — partial signals (null git)', () => {
    it('omits task section when git is null', () => {
      const ctx: NarrativeContext = { ...makeFullContext(), git: null };
      const sections = gen.generate(ctx);
      expect(sections.find((s) => s.id === 'task')).toBeUndefined();
    });

    it('header has no branch when git is null', () => {
      const ctx: NarrativeContext = { ...makeFullContext(), git: null };
      const sections = gen.generate(ctx);
      const header = sections.find((s) => s.id === 'header')!;
      expect(header.content).not.toContain('branch');
    });

    it('still generates header and footer when git is null', () => {
      const ctx: NarrativeContext = { ...makeFullContext(), git: null };
      const sections = gen.generate(ctx);
      expect(sections.find((s) => s.id === 'header')).toBeDefined();
      expect(sections.find((s) => s.id === 'footer')).toBeDefined();
    });

    it('omits editor section when editor is null', () => {
      const ctx: NarrativeContext = { ...makeFullContext(), editor: null };
      const sections = gen.generate(ctx);
      expect(sections.find((s) => s.id === 'code')).toBeUndefined();
    });

    it('omits todos section when todos is null', () => {
      const ctx: NarrativeContext = { ...makeFullContext(), todos: null };
      const sections = gen.generate(ctx);
      expect(sections.find((s) => s.id === 'todos')).toBeUndefined();
    });

    it('omits todos section when todos.items is empty', () => {
      const ctx: NarrativeContext = { ...makeFullContext(), todos: { items: [] } };
      const sections = gen.generate(ctx);
      expect(sections.find((s) => s.id === 'todos')).toBeUndefined();
    });

    it('omits files section when recentFiles is null', () => {
      const ctx: NarrativeContext = { ...makeFullContext(), recentFiles: null };
      const sections = gen.generate(ctx);
      expect(sections.find((s) => s.id === 'files')).toBeUndefined();
    });

    it('omits files section when recentFiles.files is empty', () => {
      const ctx: NarrativeContext = { ...makeFullContext(), recentFiles: { files: [] } };
      const sections = gen.generate(ctx);
      expect(sections.find((s) => s.id === 'files')).toBeUndefined();
    });

    it('git section shows clean working tree message when no changes', () => {
      const ctx: NarrativeContext = {
        ...makeFullContext(),
        git: makeGit({ stagedFiles: [], modifiedFiles: [], untrackedFiles: [] }),
      };
      const sections = gen.generate(ctx);
      const task = sections.find((s) => s.id === 'task')!;
      expect(task.content).toContain('clean');
    });
  });

  describe('generate() — empty signals (all null)', () => {
    const emptyCtx: NarrativeContext = {
      capturedAt: CAPTURED_AT,
      workspaceName: 'my-project',
      git: null,
      editor: null,
      todos: null,
      recentFiles: null,
      terminal: null,
    };

    it('returns exactly [header, footer]', () => {
      const sections = gen.generate(emptyCtx);
      expect(sections).toHaveLength(2);
      expect(sections[0].id).toBe('header');
      expect(sections[1].id).toBe('footer');
    });

    it('header still contains workspace name', () => {
      const sections = gen.generate(emptyCtx);
      expect(sections[0].content).toContain('my-project');
    });

    it('footer shows generic resume message when no hints available', () => {
      const sections = gen.generate(emptyCtx);
      expect(sections[1].content).toContain('Review the sections above');
    });
  });

  describe('section titles', () => {
    it('each section has a non-empty title', () => {
      const sections = gen.generate(makeFullContext());
      for (const section of sections) {
        expect(section.title.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('selectedText rendering', () => {
    it('includes selected text block in code section when present', () => {
      const ctx: NarrativeContext = {
        ...makeFullContext(),
        editor: makeEditor({ selectedText: 'const x = 42;' }),
      };
      const sections = gen.generate(ctx);
      const code = sections.find((s) => s.id === 'code')!;
      expect(code.content).toContain('const x = 42;');
    });
  });
});
