import * as crypto from 'crypto';

/**
 * Derives a stable, short workspace identifier from the workspace root fsPath.
 * Uses SHA-256 truncated to 16 hex characters (64-bit collision resistance —
 * more than enough for a local workspace list).
 */
export function workspaceId(fsPath: string): string {
  return crypto.createHash('sha256').update(fsPath).digest('hex').slice(0, 16);
}
