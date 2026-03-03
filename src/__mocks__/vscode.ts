/**
 * Minimal VSCode API mock for unit tests.
 * Only stubs the parts used by Logger and StorageService.
 */

export const window = {
  createOutputChannel: () => ({
    appendLine: () => {},
    dispose: () => {},
  }),
  activeTextEditor: undefined,
  onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
  onDidChangeTextEditorSelection: () => ({ dispose: () => {} }),
  onDidChangeTerminalState: () => ({ dispose: () => {} }),
};

export const workspace = {
  getConfiguration: () => ({
    get: (_key: string, defaultValue: unknown) => defaultValue,
  }),
  textDocuments: [],
  workspaceFolders: undefined,
  onDidChangeTextDocument: () => ({ dispose: () => {} }),
};

export const commands = {
  executeCommand: async () => undefined,
  registerCommand: () => ({ dispose: () => {} }),
};

export class EventEmitter<T> {
  event = (_listener: (e: T) => void) => ({ dispose: () => {} });
  fire(_e: T) {}
  dispose() {}
}

export class Uri {
  static file(path: string) { return { fsPath: path, scheme: 'file' }; }
  fsPath = '';
  scheme = '';
}

export class Position {
  constructor(public line: number, public character: number) {}
}

export class Disposable {
  constructor(private callOnDispose: () => void) {}
  dispose() { this.callOnDispose(); }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const OutputChannel = {} as any;
