import React, { useEffect, useState } from 'react';
import { useVSCodeBridge } from './hooks/useVSCodeBridge';
import type { CheckpointSummary, Checkpoint } from '../../types/index';
import { CheckpointList } from './components/CheckpointList';
import { CheckpointDetail } from './components/CheckpointDetail';

type View = 'list' | 'detail';

export function App() {
  const { postMessage, onMessage } = useVSCodeBridge();
  const [checkpoints, setCheckpoints] = useState<CheckpointSummary[]>([]);
  const [activeCheckpoint, setActiveCheckpoint] = useState<Checkpoint | null>(null);
  const [view, setView] = useState<View>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Signal readiness and listen for messages
  useEffect(() => {
    postMessage({ type: 'ready' });

    return onMessage((msg) => {
      switch (msg.type) {
        case 'init':
          setCheckpoints(msg.checkpoints);
          setLoading(false);
          break;

        case 'checkpoint-created':
          setCheckpoints((prev) => [msg.summary, ...prev]);
          break;

        case 'checkpoint-deleted':
          setCheckpoints((prev) => prev.filter((c) => c.id !== msg.id));
          if (activeCheckpoint?.metadata.id === msg.id) {
            setActiveCheckpoint(null);
            setView('list');
          }
          break;

        case 'checkpoint-loaded':
          setActiveCheckpoint(msg.checkpoint);
          setView('detail');
          break;

        case 'error':
          setError(msg.message);
          break;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (id: string) => {
    postMessage({ type: 'load-checkpoint', id });
  };

  const handleDelete = (id: string) => {
    postMessage({ type: 'delete-checkpoint', id });
  };

  const handleCapture = () => {
    postMessage({ type: 'capture-now' });
  };

  const handleBack = () => {
    setView('list');
    setActiveCheckpoint(null);
  };

  if (loading) {
    return <div style={styles.center}>Loading checkpoints…</div>;
  }

  if (error) {
    return <div style={styles.error}>Error: {error}</div>;
  }

  if (view === 'detail' && activeCheckpoint) {
    return (
      <CheckpointDetail
        checkpoint={activeCheckpoint}
        onBack={handleBack}
        onDelete={() => handleDelete(activeCheckpoint.metadata.id)}
      />
    );
  }

  return (
    <CheckpointList
      checkpoints={checkpoints}
      onSelect={handleSelect}
      onDelete={handleDelete}
      onCapture={handleCapture}
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    opacity: 0.6,
  },
  error: {
    padding: '12px',
    color: 'var(--vscode-errorForeground)',
  },
};
