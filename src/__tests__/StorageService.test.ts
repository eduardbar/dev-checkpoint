import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { StorageService } from '../storage/StorageService';
import type { Checkpoint, NarrativeContext } from '../types/index';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'dev-checkpoint-test-'));
}

function makeCheckpoint(id: string, workspaceName = 'test-workspace'): Checkpoint {
  const ctx: NarrativeContext = {
    capturedAt: new Date().toISOString(),
    workspaceName,
    git: null,
    editor: null,
    todos: null,
    recentFiles: null,
    terminal: null,
  };

  return {
    metadata: {
      id,
      createdAt: new Date().toISOString(),
      trigger: 'manual',
      workspaceFsPath: '/workspace/test',
      workspaceName,
      sizeBytes: 0, // will be filled by StorageService
    },
    narrative: [
      { id: 'header', title: '📍 Checkpoint', content: `${workspaceName} — checkpoint captured` },
      { id: 'footer', title: '▶ Resume Hint', content: 'Review the sections above.' },
    ],
    signals: ctx,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('StorageService', () => {
  let tmpDir: string;
  let service: StorageService;
  const WORKSPACE_PATH = '/workspace/test';

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
    // maxCheckpointsOverride=50, no vscode dependency
    service = new StorageService(tmpDir, WORKSPACE_PATH, 50);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ── ensureDirectory ────────────────────────────────────────────

  describe('ensureDirectory()', () => {
    it('creates the workspace directory', async () => {
      await service.ensureDirectory();
      const index = await service.readIndex();
      expect(index).toBeDefined();
    });
  });

  // ── saveCheckpoint ─────────────────────────────────────────────

  describe('saveCheckpoint()', () => {
    it('saves a checkpoint and it appears in listCheckpoints()', async () => {
      const cp = makeCheckpoint('test-id-001');
      await service.saveCheckpoint(cp);

      const list = await service.listCheckpoints();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('test-id-001');
    });

    it('sets sizeBytes > 0 after saving', async () => {
      const cp = makeCheckpoint('test-id-002');
      await service.saveCheckpoint(cp);

      const list = await service.listCheckpoints();
      expect(list[0].sizeBytes).toBeGreaterThan(0);
    });

    it('updates sizeBytes on the checkpoint.metadata object', async () => {
      const cp = makeCheckpoint('test-id-meta-size');
      await service.saveCheckpoint(cp);
      // After save, metadata.sizeBytes should be filled in
      expect(cp.metadata.sizeBytes).toBeGreaterThan(0);
    });

    it('stores checkpoints newest-first', async () => {
      await service.saveCheckpoint(makeCheckpoint('first'));
      await service.saveCheckpoint(makeCheckpoint('second'));
      await service.saveCheckpoint(makeCheckpoint('third'));

      const list = await service.listCheckpoints();
      expect(list[0].id).toBe('third');
      expect(list[1].id).toBe('second');
      expect(list[2].id).toBe('first');
    });

    it('updates totalBytes in the index after each save', async () => {
      await service.saveCheckpoint(makeCheckpoint('b1'));
      await service.saveCheckpoint(makeCheckpoint('b2'));

      const index = await service.readIndex();
      expect(index.totalBytes).toBeGreaterThan(0);
    });

    it('saves a checkpoint file to disk (physical file exists)', async () => {
      const cp = makeCheckpoint('physical-check');
      await service.saveCheckpoint(cp);

      // Verify that the list is non-empty — which means the file was written + renamed
      const list = await service.listCheckpoints();
      expect(list).toHaveLength(1);

      // Also verify we can load it back
      const loaded = await service.loadCheckpoint('physical-check');
      expect(loaded).not.toBeNull();
    });
  });

  // ── loadCheckpoint ─────────────────────────────────────────────

  describe('loadCheckpoint()', () => {
    it('loads a previously saved checkpoint', async () => {
      const cp = makeCheckpoint('load-test');
      await service.saveCheckpoint(cp);

      const loaded = await service.loadCheckpoint('load-test');
      expect(loaded).not.toBeNull();
      expect(loaded!.metadata.id).toBe('load-test');
    });

    it('returns null for a non-existent ID', async () => {
      const result = await service.loadCheckpoint('does-not-exist');
      expect(result).toBeNull();
    });

    it('preserves narrative sections after round-trip', async () => {
      const cp = makeCheckpoint('narrative-test');
      await service.saveCheckpoint(cp);

      const loaded = await service.loadCheckpoint('narrative-test');
      expect(loaded!.narrative).toHaveLength(2);
      expect(loaded!.narrative[0].id).toBe('header');
      expect(loaded!.narrative[1].id).toBe('footer');
    });
  });

  // ── listCheckpoints ────────────────────────────────────────────

  describe('listCheckpoints()', () => {
    it('returns empty array when no checkpoints saved', async () => {
      const list = await service.listCheckpoints();
      expect(list).toEqual([]);
    });

    it('returns correct number of checkpoints', async () => {
      await service.saveCheckpoint(makeCheckpoint('l1'));
      await service.saveCheckpoint(makeCheckpoint('l2'));
      await service.saveCheckpoint(makeCheckpoint('l3'));

      const list = await service.listCheckpoints();
      expect(list).toHaveLength(3);
    });

    it('each summary has the expected fields', async () => {
      await service.saveCheckpoint(makeCheckpoint('summary-check', 'my-workspace'));
      const list = await service.listCheckpoints();
      const item = list[0];

      expect(item.id).toBe('summary-check');
      expect(item.workspaceName).toBe('my-workspace');
      expect(item.trigger).toBe('manual');
      expect(item.sizeBytes).toBeGreaterThan(0);
      expect(item.preview.length).toBeGreaterThan(0);
    });
  });

  // ── deleteCheckpoint ───────────────────────────────────────────

  describe('deleteCheckpoint()', () => {
    it('removes checkpoint from the list after deletion', async () => {
      await service.saveCheckpoint(makeCheckpoint('del-me'));
      await service.deleteCheckpoint('del-me');

      const list = await service.listCheckpoints();
      expect(list.find((c) => c.id === 'del-me')).toBeUndefined();
    });

    it('returns null for a deleted checkpoint', async () => {
      await service.saveCheckpoint(makeCheckpoint('del-load'));
      await service.deleteCheckpoint('del-load');

      const loaded = await service.loadCheckpoint('del-load');
      expect(loaded).toBeNull();
    });

    it('does not throw when deleting non-existent ID', async () => {
      await expect(service.deleteCheckpoint('ghost-id')).resolves.not.toThrow();
    });

    it('deleting one of several only removes that one', async () => {
      await service.saveCheckpoint(makeCheckpoint('keep-1'));
      await service.saveCheckpoint(makeCheckpoint('delete-me'));
      await service.saveCheckpoint(makeCheckpoint('keep-2'));

      await service.deleteCheckpoint('delete-me');

      const list = await service.listCheckpoints();
      expect(list).toHaveLength(2);
      expect(list.map((c) => c.id)).not.toContain('delete-me');
      expect(list.map((c) => c.id)).toContain('keep-1');
      expect(list.map((c) => c.id)).toContain('keep-2');
    });
  });

  // ── pruning ────────────────────────────────────────────────────

  describe('pruning (maxCheckpoints)', () => {
    it('prunes oldest checkpoints when limit is exceeded', async () => {
      const smallService = new StorageService(tmpDir, '/workspace/prune-test', 3);

      await smallService.saveCheckpoint(makeCheckpoint('p1'));
      await smallService.saveCheckpoint(makeCheckpoint('p2'));
      await smallService.saveCheckpoint(makeCheckpoint('p3'));
      // Adding a 4th should prune the oldest (p1)
      await smallService.saveCheckpoint(makeCheckpoint('p4'));

      const list = await smallService.listCheckpoints();
      expect(list).toHaveLength(3);
      expect(list.map((c) => c.id)).not.toContain('p1');
      expect(list.map((c) => c.id)).toContain('p4'); // newest kept
    });

    it('keeps exactly maxCheckpoints after multiple inserts', async () => {
      const smallService = new StorageService(tmpDir, '/workspace/prune-exact', 2);

      for (let i = 0; i < 5; i++) {
        await smallService.saveCheckpoint(makeCheckpoint(`ep${i}`));
      }

      const list = await smallService.listCheckpoints();
      expect(list).toHaveLength(2);
      // Newest two (ep3, ep4) should be kept
      expect(list[0].id).toBe('ep4');
      expect(list[1].id).toBe('ep3');
    });
  });

  // ── data isolation ─────────────────────────────────────────────

  describe('workspace isolation', () => {
    it('two services with different workspace paths have separate storage', async () => {
      const serviceA = new StorageService(tmpDir, '/workspace/project-a', 50);
      const serviceB = new StorageService(tmpDir, '/workspace/project-b', 50);

      await serviceA.saveCheckpoint(makeCheckpoint('a-checkpoint'));

      const listA = await serviceA.listCheckpoints();
      const listB = await serviceB.listCheckpoints();

      expect(listA).toHaveLength(1);
      expect(listB).toHaveLength(0);
    });
  });
});
