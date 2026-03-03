// ============================================================
// Core domain types for dev-checkpoint VSCode extension
// ============================================================

// ──────────────────────────────────────────────────────────────
// Signals — raw data collected by each collector
// ──────────────────────────────────────────────────────────────

export interface GitSignal {
  branch: string | null;
  /** Last commit short hash */
  commitHash: string | null;
  /** Last commit message subject line */
  commitMessage: string | null;
  /** Staged file paths */
  stagedFiles: string[];
  /** Unstaged/modified file paths */
  modifiedFiles: string[];
  /** Untracked file paths */
  untrackedFiles: string[];
  /** True if git repo detected in workspace */
  isRepo: boolean;
}

export interface EditorSignal {
  /** Currently active file, relative to workspace root */
  activeFile: string | null;
  /** Cursor position in the active file */
  cursorPosition: { line: number; character: number } | null;
  /** Open file paths (relative to workspace root), max 10 */
  openFiles: string[];
  /** Selected text, max 200 chars */
  selectedText: string | null;
  /** Visible symbols in active file (function/class names near cursor) */
  visibleSymbols: string[];
}

export interface TodoSignal {
  /** TODO/FIXME/HACK comments found in recently modified files */
  items: TodoItem[];
}

export interface TodoItem {
  file: string;
  line: number;
  /** "TODO" | "FIXME" | "HACK" | "NOTE" */
  tag: string;
  text: string;
}

export interface RecentFilesSignal {
  /** Recently edited files ordered by recency (relative paths), max 5 */
  files: string[];
}

export interface TerminalSignal {
  /** Last N lines of terminal output (platform-specific, best-effort) */
  lastOutput: string[];
  /** Detected shell type */
  shellType: 'bash' | 'zsh' | 'fish' | 'powershell' | 'cmd' | 'unknown';
}

/** Union of all signal types */
export type SignalData =
  | GitSignal
  | EditorSignal
  | TodoSignal
  | RecentFilesSignal
  | TerminalSignal;

// ──────────────────────────────────────────────────────────────
// Collector result wrapper
// ──────────────────────────────────────────────────────────────

/** A successfully collected signal */
export interface CollectorResult<T extends SignalData> {
  ok: true;
  data: T;
  /** Collection duration in milliseconds */
  durationMs: number;
}

/** A failed collector — never throws, always returns this shape */
export interface CollectorError {
  ok: false;
  reason: string;
  /** Collector that failed */
  collector: string;
}

export type CollectorOutcome<T extends SignalData> =
  | CollectorResult<T>
  | CollectorError;

// ──────────────────────────────────────────────────────────────
// Narrative
// ──────────────────────────────────────────────────────────────

/** Input context passed to the narrative generator */
export interface NarrativeContext {
  git: GitSignal | null;
  editor: EditorSignal | null;
  todos: TodoSignal | null;
  recentFiles: RecentFilesSignal | null;
  terminal: TerminalSignal | null;
  /** ISO timestamp of capture */
  capturedAt: string;
  /** Workspace name */
  workspaceName: string;
}

/** One paragraph/section in the generated narrative */
export interface NarrativeSection {
  /** Section identifier */
  id: 'header' | 'task' | 'code' | 'todos' | 'files' | 'footer';
  /** Section title */
  title: string;
  /** Rendered markdown content */
  content: string;
}

// ──────────────────────────────────────────────────────────────
// Checkpoint — the persisted unit
// ──────────────────────────────────────────────────────────────

export interface CheckpointMetadata {
  /** Unique identifier: `{timestamp}-{nanoid6}` */
  id: string;
  /** ISO 8601 */
  createdAt: string;
  /** "manual" | "auto" */
  trigger: 'manual' | 'auto';
  /** Workspace root fsPath */
  workspaceFsPath: string;
  /** Display name of workspace */
  workspaceName: string;
  /** File size in bytes */
  sizeBytes: number;
}

export interface Checkpoint {
  metadata: CheckpointMetadata;
  narrative: NarrativeSection[];
  /** Raw signals — preserved for future re-rendering */
  signals: NarrativeContext;
}

// ──────────────────────────────────────────────────────────────
// Storage index
// ──────────────────────────────────────────────────────────────

/** Lightweight summary stored in index.json — avoids reading full checkpoint files */
export interface CheckpointSummary {
  id: string;
  createdAt: string;
  trigger: 'manual' | 'auto';
  workspaceName: string;
  /** First ~80 chars of the narrative header for quick preview */
  preview: string;
  sizeBytes: number;
}

/** Shape of `index.json` stored per workspace */
export interface StorageIndex {
  workspaceId: string;
  workspaceFsPath: string;
  /** Ordered newest-first */
  checkpoints: CheckpointSummary[];
  /** Total bytes used by all checkpoint files */
  totalBytes: number;
  lastUpdated: string;
}

// ──────────────────────────────────────────────────────────────
// Webview messages
// ──────────────────────────────────────────────────────────────

/** Messages from extension host → webview */
export type ExtensionToWebviewMessage =
  | { type: 'init'; checkpoints: CheckpointSummary[]; activeId: string | null }
  | { type: 'checkpoint-created'; summary: CheckpointSummary }
  | { type: 'checkpoint-deleted'; id: string }
  | { type: 'checkpoint-loaded'; checkpoint: Checkpoint }
  | { type: 'error'; message: string };

/** Messages from webview → extension host */
export type WebviewToExtensionMessage =
  | { type: 'load-checkpoint'; id: string }
  | { type: 'delete-checkpoint'; id: string }
  | { type: 'capture-now' }
  | { type: 'ready' };

/** Union type for all webview messages */
export type WebviewMessage =
  | ExtensionToWebviewMessage
  | WebviewToExtensionMessage;
