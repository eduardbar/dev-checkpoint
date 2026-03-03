import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  Checkpoint,
  CheckpointSummary,
  StorageIndex,
} from '../types/index';
import { workspaceId } from '../utils/hash';
import { Logger } from '../utils/logger';

const INDEX_FILE = 'index.json';

/**
 * StorageService manages checkpoint persistence.
 *
 * Layout:
 *   <storageDir>/
 *     checkpoints/
 *       <workspaceId>/
 *         index.json        ← lightweight summary list
 *         <id>.json         ← full checkpoint data
 *
 * All operations are atomic-ish: we write to a temp file then rename,
 * so a crash mid-write never leaves a corrupt primary file.
 *
 * @param storageRootUri   VSCode globalStorageUri.fsPath  OR  any directory (for tests)
 * @param workspaceFsPath  Workspace root path — used to derive a stable workspace ID
 * @param maxCheckpointsOverride  Optional override for max checkpoints (used in tests)
 */
export class StorageService {
  private readonly workspaceDir: string;
  private readonly wsId: string;

  constructor(
    storageRootFsPath: string,
    private readonly workspaceFsPath: string,
    private readonly maxCheckpointsOverride?: number
  ) {
    this.wsId = workspaceId(workspaceFsPath);
    this.workspaceDir = path.join(
      storageRootFsPath,
      'checkpoints',
      this.wsId
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Bootstrap
  // ──────────────────────────────────────────────────────────────

  async ensureDirectory(): Promise<void> {
    await fs.mkdir(this.workspaceDir, { recursive: true });
  }

  // ──────────────────────────────────────────────────────────────
  // Index operations
  // ──────────────────────────────────────────────────────────────

  private indexPath(): string {
    return path.join(this.workspaceDir, INDEX_FILE);
  }

  async readIndex(): Promise<StorageIndex> {
    try {
      const raw = await fs.readFile(this.indexPath(), 'utf-8');
      return JSON.parse(raw) as StorageIndex;
    } catch {
      // First run — return empty index
      return {
        workspaceId: this.wsId,
        workspaceFsPath: this.workspaceFsPath,
        checkpoints: [],
        totalBytes: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  private async writeIndex(index: StorageIndex): Promise<void> {
    const tmpPath = this.indexPath() + '.tmp';
    await fs.writeFile(tmpPath, JSON.stringify(index, null, 2), 'utf-8');
    await fs.rename(tmpPath, this.indexPath());
  }

  // ──────────────────────────────────────────────────────────────
  // Checkpoint operations
  // ──────────────────────────────────────────────────────────────

  private checkpointPath(id: string): string {
    return path.join(this.workspaceDir, `${id}.json`);
  }

  async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    await this.ensureDirectory();

    const serialized = JSON.stringify(checkpoint, null, 2);
    const sizeBytes = Buffer.byteLength(serialized, 'utf-8');

    // Update sizeBytes on the checkpoint metadata before writing
    checkpoint.metadata.sizeBytes = sizeBytes;

    // Write checkpoint file (atomic via tmp + rename)
    const serializedFinal = JSON.stringify(checkpoint, null, 2);
    const filePath = this.checkpointPath(checkpoint.metadata.id);
    const tmpPath = filePath + '.tmp';
    await fs.writeFile(tmpPath, serializedFinal, 'utf-8');
    await fs.rename(tmpPath, filePath);

    // Update index
    const index = await this.readIndex();
    const summary: CheckpointSummary = {
      id: checkpoint.metadata.id,
      createdAt: checkpoint.metadata.createdAt,
      trigger: checkpoint.metadata.trigger,
      workspaceName: checkpoint.metadata.workspaceName,
      preview: this.buildPreview(checkpoint),
      sizeBytes,
    };

    // Prepend newest first
    index.checkpoints.unshift(summary);
    index.totalBytes += sizeBytes;
    index.lastUpdated = new Date().toISOString();

    await this.pruneIfNeeded(index);
    await this.writeIndex(index);

    Logger.info(`Checkpoint saved: ${checkpoint.metadata.id} (${sizeBytes}B)`);
  }

  async loadCheckpoint(id: string): Promise<Checkpoint | null> {
    try {
      const raw = await fs.readFile(this.checkpointPath(id), 'utf-8');
      return JSON.parse(raw) as Checkpoint;
    } catch (err) {
      Logger.warn(`Failed to load checkpoint ${id}:`, err);
      return null;
    }
  }

  async deleteCheckpoint(id: string): Promise<void> {
    // Ensure directory exists before writing index
    await this.ensureDirectory();

    const filePath = this.checkpointPath(id);
    let deletedSize = 0;

    try {
      const stat = await fs.stat(filePath);
      deletedSize = stat.size;
      await fs.unlink(filePath);
    } catch {
      // File may already be gone — that's fine
    }

    const index = await this.readIndex();
    index.checkpoints = index.checkpoints.filter((c) => c.id !== id);
    index.totalBytes = Math.max(0, index.totalBytes - deletedSize);
    index.lastUpdated = new Date().toISOString();
    await this.writeIndex(index);

    Logger.info(`Checkpoint deleted: ${id}`);
  }

  async listCheckpoints(): Promise<CheckpointSummary[]> {
    const index = await this.readIndex();
    return index.checkpoints;
  }

  // ──────────────────────────────────────────────────────────────
  // Pruning — respect maxCheckpoints config
  // ──────────────────────────────────────────────────────────────

  private getMaxCheckpoints(): number {
    if (this.maxCheckpointsOverride !== undefined) {
      return this.maxCheckpointsOverride;
    }
    // Lazy import vscode only at runtime (not during tests)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const vscode = require('vscode') as typeof import('vscode');
      const config = vscode.workspace.getConfiguration('devCheckpoint');
      return config.get<number>('maxCheckpoints', 50);
    } catch {
      return 50;
    }
  }

  private async pruneIfNeeded(index: StorageIndex): Promise<void> {
    const maxCheckpoints = this.getMaxCheckpoints();

    while (index.checkpoints.length > maxCheckpoints) {
      const oldest = index.checkpoints.pop(); // array is newest-first
      if (!oldest) break;

      try {
        const filePath = this.checkpointPath(oldest.id);
        await fs.unlink(filePath);
        index.totalBytes = Math.max(0, index.totalBytes - oldest.sizeBytes);
        Logger.info(`Pruned old checkpoint: ${oldest.id}`);
      } catch {
        // Already deleted — ignore
      }
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────

  private buildPreview(checkpoint: Checkpoint): string {
    const header = checkpoint.narrative.find((s) => s.id === 'header');
    if (header) {
      return header.content.slice(0, 80).replace(/\n/g, ' ');
    }
    return 'Checkpoint';
  }
}
