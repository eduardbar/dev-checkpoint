import React from 'react';
import type { CheckpointSummary } from '../../../types/index';

interface Props {
  checkpoints: CheckpointSummary[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCapture: () => void;
}

export function CheckpointList({
  checkpoints,
  onSelect,
  onDelete,
  onCapture,
}: Props) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Checkpoints</span>
        <button
          style={styles.captureBtn}
          onClick={onCapture}
          title="Capture context now"
        >
          + Capture
        </button>
      </div>

      {checkpoints.length === 0 ? (
        <div style={styles.empty}>
          <p>No checkpoints yet.</p>
          <p style={styles.hint}>
            Press <strong>+ Capture</strong> or run{' '}
            <code>Dev Checkpoint: Capture Context</code> from the command
            palette.
          </p>
        </div>
      ) : (
        <ul style={styles.list}>
          {checkpoints.map((cp) => (
            <CheckpointItem
              key={cp.id}
              summary={cp}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface ItemProps {
  summary: CheckpointSummary;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function CheckpointItem({ summary, onSelect, onDelete }: ItemProps) {
  const date = new Date(summary.createdAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li style={styles.item}>
      <button
        style={styles.itemMain}
        onClick={() => onSelect(summary.id)}
        title="Open checkpoint"
      >
        <div style={styles.itemTop}>
          <span style={styles.date}>{date}</span>
          <span
            style={{
              ...styles.badge,
              background:
                summary.trigger === 'manual'
                  ? 'var(--vscode-badge-background)'
                  : 'var(--vscode-activityBarBadge-background)',
            }}
          >
            {summary.trigger}
          </span>
        </div>
        <div style={styles.preview}>{summary.preview}</div>
      </button>
      <button
        style={styles.deleteBtn}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(summary.id);
        }}
        title="Delete checkpoint"
      >
        ×
      </button>
    </li>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid var(--vscode-panel-border)',
  },
  title: { fontWeight: 600, fontSize: '13px' },
  captureBtn: {
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    borderRadius: '3px',
    padding: '3px 10px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  list: { listStyle: 'none', margin: 0, padding: 0, overflowY: 'auto' },
  item: {
    display: 'flex',
    alignItems: 'stretch',
    borderBottom: '1px solid var(--vscode-panel-border)',
  },
  itemMain: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    padding: '8px 12px',
    textAlign: 'left',
  },
  itemTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  date: { fontSize: '11px', opacity: 0.7 },
  badge: {
    fontSize: '10px',
    padding: '1px 5px',
    borderRadius: '10px',
    color: 'var(--vscode-badge-foreground)',
  },
  preview: {
    fontSize: '12px',
    opacity: 0.85,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    padding: '0 12px',
    fontSize: '18px',
    opacity: 0.5,
    alignSelf: 'center',
  },
  empty: {
    padding: '24px 16px',
    textAlign: 'center',
    opacity: 0.7,
  },
  hint: { fontSize: '12px', marginTop: '8px' },
};
