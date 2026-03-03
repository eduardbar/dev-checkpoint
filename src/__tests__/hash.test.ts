import { describe, it, expect } from 'vitest';
import { workspaceId } from '../utils/hash';

describe('workspaceId', () => {
  it('returns a 16-character hex string', () => {
    const id = workspaceId('/home/user/my-project');
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic — same input always produces same output', () => {
    const path = '/Users/eduardo/dev/my-app';
    expect(workspaceId(path)).toBe(workspaceId(path));
    expect(workspaceId(path)).toBe(workspaceId(path));
  });

  it('produces different IDs for different paths', () => {
    const a = workspaceId('/projects/foo');
    const b = workspaceId('/projects/bar');
    expect(a).not.toBe(b);
  });

  it('handles empty string input without throwing', () => {
    const id = workspaceId('');
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('handles Windows-style paths', () => {
    const id = workspaceId('C:\\Users\\eduar\\dev-checkpoint');
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    // Same path → same id
    expect(id).toBe(workspaceId('C:\\Users\\eduar\\dev-checkpoint'));
  });
});
