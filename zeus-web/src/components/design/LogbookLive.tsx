import { useEffect, useState } from 'react';
import { useLoggerStore } from '../../state/logger-store';

export function LogbookLive() {
  const entries = useLoggerStore((s) => s.entries);
  const totalCount = useLoggerStore((s) => s.totalCount);
  const loading = useLoggerStore((s) => s.loading);
  const exportAdif = useLoggerStore((s) => s.exportAdif);
  const publishSelectedToQrz = useLoggerStore((s) => s.publishSelectedToQrz);
  const publishInFlight = useLoggerStore((s) => s.publishInFlight);
  const lastPublishResult = useLoggerStore((s) => s.lastPublishResult);
  const clearPublishResult = useLoggerStore((s) => s.clearPublishResult);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Clear publish result after showing it for a few seconds
    if (lastPublishResult) {
      const timer = setTimeout(() => {
        clearPublishResult();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [lastPublishResult, clearPublishResult]);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handlePublishToQrz = async () => {
    if (selectedIds.size === 0) return;
    await publishSelectedToQrz(Array.from(selectedIds));
    setSelectedIds(new Set()); // Clear selection after publish
  };

  if (loading && entries.length === 0) {
    return (
      <div className="logbook">
        <div className="log-rows" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
          Loading log entries...
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="logbook">
        <div className="log-rows" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
          No log entries yet. Log a QSO from the QRZ panel to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="logbook">
      <div className="log-head mono">
        <span style={{ width: '2rem' }}>✓</span>
        <span>Date</span>
        <span>Time</span>
        <span>Call</span>
        <span>Freq</span>
        <span>Mode</span>
        <span>RST</span>
        <span>Name</span>
      </div>
      <div className="log-rows">
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`log-row mono ${selectedIds.has(entry.id) ? 'selected' : ''}`}
          >
            <span style={{ width: '2rem' }}>
              <input
                type="checkbox"
                checked={selectedIds.has(entry.id)}
                onChange={() => handleToggleSelect(entry.id)}
                onClick={(e) => e.stopPropagation()}
                style={{ cursor: 'pointer' }}
              />
            </span>
            <span className="t-date">{formatDate(entry.qsoDateTimeUtc)}</span>
            <span className="t-time">{formatTime(entry.qsoDateTimeUtc)}</span>
            <span className="t-call">{entry.callsign}</span>
            <span>{entry.frequencyMhz.toFixed(3)}</span>
            <span className="t-mode">{entry.mode}</span>
            <span>{entry.rstSent}/{entry.rstRcvd}</span>
            <span className="t-name">{entry.name ?? '—'}</span>
            {entry.qrzLogId && (
              <span style={{ marginLeft: '0.5rem', color: 'var(--accent)', fontSize: '0.7em' }}>
                ✓ QRZ
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="log-foot">
        {lastPublishResult && (
          <div
            style={{
              fontSize: '0.7em',
              color: lastPublishResult.failedCount > 0 ? 'var(--fg-error)' : 'var(--accent)',
              marginRight: '0.5rem',
            }}
          >
            Published: {lastPublishResult.successCount} ok, {lastPublishResult.failedCount} failed
          </div>
        )}
        <button
          type="button"
          className="btn sm"
          onClick={handlePublishToQrz}
          disabled={selectedIds.size === 0 || publishInFlight}
          title="Publish selected QSOs to QRZ logbook"
        >
          {publishInFlight ? 'Publishing...' : `Publish to QRZ (${selectedIds.size})`}
        </button>
        <button
          type="button"
          className="btn sm"
          onClick={exportAdif}
          style={{ marginLeft: '0.5rem' }}
          title="Export all log entries to ADIF file"
        >
          Export ADIF
        </button>
        <span style={{ flex: 1 }} />
        <span className="label-xs">{entries.length} of {totalCount}</span>
      </div>
    </div>
  );
}
