import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from '../../types/index';

// Acquire VSCode API ONCE at module level — calling it more than once throws
declare function acquireVsCodeApi(): {
  postMessage: (msg: WebviewToExtensionMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

const vscode = acquireVsCodeApi();

/**
 * useVSCodeBridge — hook for bidirectional communication with the extension host.
 *
 * - postMessage: send a message to the extension host
 * - onMessage: register a handler (call inside useEffect)
 *
 * Usage:
 *   const { postMessage, onMessage } = useVSCodeBridge();
 *   useEffect(() => onMessage((msg) => { ... }), []);
 */
export function useVSCodeBridge() {
  const postMessage = (message: WebviewToExtensionMessage) => {
    vscode.postMessage(message);
  };

  const onMessage = (
    handler: (message: ExtensionToWebviewMessage) => void
  ): (() => void) => {
    const listener = (event: MessageEvent) => {
      handler(event.data as ExtensionToWebviewMessage);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  };

  return { postMessage, onMessage };
}
