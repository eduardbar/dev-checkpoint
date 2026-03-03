import React from 'react';
import type { Checkpoint, NarrativeSection } from '../../../types/index';

interface Props {
  checkpoint: Checkpoint;
  onBack: () => void;
  onDelete: () => void;
}

export function CheckpointDetail({ checkpoint, onBack, onDelete }: Props) {
  const { metadata, narrative } = checkpoint;
  const date = new Date(metadata.createdAt).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <button style={styles.backBtn} onClick={onBack} title="Back to list">
          ← Back
        </button>
        <button
          style={styles.deleteBtn}
          onClick={onDelete}
          title="Delete this checkpoint"
        >
          Delete
        </button>
      </div>

      {/* Meta */}
      <div style={styles.meta}>
        <span style={styles.workspace}>{metadata.workspaceName}</span>
        <span style={styles.date}>{date}</span>
        <span style={styles.trigger}>{metadata.trigger}</span>
      </div>

      {/* Narrative sections */}
      <div style={styles.content}>
        {narrative.map((section) => (
          <NarrativeSectionView key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}

function NarrativeSectionView({ section }: { section: NarrativeSection }) {
  return (
    <section style={styles.section}>
      <h3 style={styles.sectionTitle}>{section.title}</h3>
      <div
        style={styles.sectionContent}
        // Markdown is plain text here — render as preformatted for safety
        // (no innerHTML to avoid XSS)
      >
        <pre style={styles.pre}>{section.content}</pre>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid var(--vscode-panel-border)',
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--vscode-textLink-foreground)',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px 0',
  },
  deleteBtn: {
    background: 'transparent',
    border: '1px solid var(--vscode-errorForeground)',
    color: 'var(--vscode-errorForeground)',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px 8px',
  },
  meta: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--vscode-panel-border)',
    fontSize: '11px',
  },
  workspace: { fontWeight: 600 },
  date: { opacity: 0.7 },
  trigger: {
    background: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)',
    padding: '1px 5px',
    borderRadius: '10px',
    fontSize: '10px',
  },
  content: { overflowY: 'auto', flex: 1, padding: '0 4px' },
  section: {
    borderBottom: '1px solid var(--vscode-panel-border)',
    padding: '10px 12px',
  },
  sectionTitle: {
    margin: '0 0 6px',
    fontSize: '12px',
    fontWeight: 600,
    opacity: 0.9,
  },
  sectionContent: {},
  pre: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontSize: '12px',
    lineHeight: 1.5,
    opacity: 0.85,
  },
};
