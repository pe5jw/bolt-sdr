// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// "Meter Group" — a top-level workspace panel holding a single row OR
// column of meters that share the available width / height. Replaces the
// older nested-groups MetersPanel: each former group becomes its own
// top-level tile, the operator drags it around the workspace via the
// usual tile chrome, and the panel's body is just a flex container of
// meter widgets.
//
// Header layout (left → right):
//   [grip] [title] [pencil-rename] | [direction toggle] [+ meter] [×]
//
// Body: flex container in `direction` (row or column). Each widget is
// rendered bare via `MeterRenderer` and grows via `flex: 1` so N widgets
// share the available width / height equally.

import { useCallback, useState, type CSSProperties } from 'react';
import {
  GripVertical,
  Plus,
  ArrowRightLeft,
  ArrowDownUp,
  Pencil,
  X,
  Trash2,
} from 'lucide-react';
import {
  EMPTY_METER_GROUP_CONFIG,
  newWidgetUid,
  type MeterGroupConfig,
  type MeterGroupWidget,
} from './meterGroupConfig';
import { MeterRenderer } from './MeterRenderer';
import { LibraryDrawer } from './LibraryDrawer';
import { MeterReadingId, METER_CATALOG } from '../meters/meterCatalog';

interface MeterGroupPanelProps {
  /** Per-instance config blob from the workspace store. */
  config?: MeterGroupConfig;
  /** Setter wired by the workspace store. */
  setConfig?: (next: MeterGroupConfig) => void;
  /** Tile-removal hook. Headerless panels own their close X. */
  onRemove?: () => void;
}

export function MeterGroupPanel({
  config = EMPTY_METER_GROUP_CONFIG,
  setConfig,
  onRemove,
}: MeterGroupPanelProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(config.title);
  const [hoveredUid, setHoveredUid] = useState<string | null>(null);

  const commit = useCallback(
    (next: MeterGroupConfig) => {
      if (setConfig) setConfig(next);
    },
    [setConfig],
  );

  const setDirection = useCallback(
    (direction: 'row' | 'column') => {
      commit({ ...config, direction });
    },
    [commit, config],
  );

  const setTitle = useCallback(
    (next: string) => {
      const trimmed = next.trim() || 'Meters';
      commit({ ...config, title: trimmed });
    },
    [commit, config],
  );

  const addWidget = useCallback(
    (reading: MeterReadingId) => {
      const def = METER_CATALOG[reading];
      const widget: MeterGroupWidget = {
        uid: newWidgetUid(),
        reading,
        kind: def.defaultKind,
      };
      commit({ ...config, widgets: [...config.widgets, widget] });
      // Close the drawer so the operator sees the new widget land in the
      // group rather than peering at it from behind the library overlay.
      setLibraryOpen(false);
    },
    [commit, config],
  );

  const removeWidget = useCallback(
    (uid: string) => {
      commit({ ...config, widgets: config.widgets.filter((w) => w.uid !== uid) });
    },
    [commit, config],
  );

  const stopDrag = (e: React.MouseEvent) => e.stopPropagation();

  // ── header styles ─────────────────────────────────────────────────
  const titleStyle: CSSProperties = {
    flex: 1,
    fontSize: 11,
    fontFamily: 'var(--font-sans)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--fg-1)',
    cursor: 'text',
    userSelect: 'none',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
  const headerBtnStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: 'var(--r-xs)',
    color: 'var(--fg-1)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'background var(--dur-fast)',
  };
  const pencilStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    color: 'var(--fg-3)',
    opacity: 0.5,
    cursor: 'pointer',
    transition: 'opacity var(--dur-fast)',
  };
  const overlayBtnStyle: CSSProperties = {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--r-xs)',
    color: 'var(--fg-2)',
    background: 'rgba(10, 11, 14, 0.65)',
    border: '1px solid rgba(255,255,255,0.06)',
    cursor: 'pointer',
    transition: 'opacity var(--dur-fast), color var(--dur-fast)',
    zIndex: 2,
  };

  return (
    <div
      data-testid="meter-group-panel"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        // Match the immersive TX Stage Meters Section card recipe so a
        // top-level Meter Group reads as the same kind of "lit section
        // on a dark bench" as the Final Output / Signal Chain / Gain
        // Reduction sections inside the immersive panel.
        background:
          'linear-gradient(180deg, var(--immersive-panel-2) 0%, var(--immersive-well) 100%)',
        border: '1px solid var(--immersive-line)',
        borderRadius: 8,
        boxShadow:
          'inset 0 1px 0 var(--immersive-rim), inset 0 0 30px rgba(0,0,0,0.25)',
      }}
    >
      {/* ── header — workspace-tile-header so RGL drag works ─────────
          Styled to mirror the immersive Section header (small dot LED +
          uppercase title with letter-spacing) so a Meter Group reads
          like the Final Output / Signal Chain / Gain Reduction sections
          inside the TX Stage Meters panel. */}
      <div className="workspace-tile-header">
        <span
          className="workspace-tile-drag-handle"
          aria-hidden="true"
          title="Drag to reposition"
        >
          <GripVertical size={12} />
        </span>
        {/* LED dot — neutral grey at idle, matches the Final Output /
            Signal Chain dot styling from ImmersiveMetersPanel.Section. */}
        <span
          aria-hidden="true"
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--fg-3)',
            marginRight: 4,
          }}
        />

        {editingTitle ? (
          <input
            type="text"
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              setTitle(titleDraft);
            }}
            onMouseDown={stopDrag}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setEditingTitle(false);
                setTitle(titleDraft);
              } else if (e.key === 'Escape') {
                setEditingTitle(false);
                setTitleDraft(config.title);
              }
            }}
            style={{
              ...titleStyle,
              background: 'var(--bg-2)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--r-xs)',
              padding: '0 4px',
              outline: 'none',
            }}
          />
        ) : (
          <>
            <span
              className="workspace-tile-title"
              role="button"
              tabIndex={0}
              title="Click to rename"
              onClick={(e) => {
                e.stopPropagation();
                setTitleDraft(config.title);
                setEditingTitle(true);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setTitleDraft(config.title);
                setEditingTitle(true);
              }}
              onMouseDown={stopDrag}
              style={titleStyle}
            >
              {config.title}
            </span>
            <span
              role="button"
              tabIndex={0}
              aria-label="Rename"
              title="Click to rename"
              onClick={(e) => {
                e.stopPropagation();
                setTitleDraft(config.title);
                setEditingTitle(true);
              }}
              onMouseDown={stopDrag}
              style={pencilStyle}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
            >
              <Pencil size={11} />
            </span>
          </>
        )}

        {/* Direction toggle: row → column → row. Single button cycles. */}
        <button
          type="button"
          aria-label={`Layout: ${config.direction}. Click to switch.`}
          title={`Layout direction: ${config.direction}. Click to flip.`}
          onClick={() => setDirection(config.direction === 'row' ? 'column' : 'row')}
          onMouseDown={stopDrag}
          style={headerBtnStyle}
          data-testid="meter-group-direction"
        >
          {config.direction === 'row' ? (
            <ArrowRightLeft size={13} />
          ) : (
            <ArrowDownUp size={13} />
          )}
        </button>

        {/* Add meter — opens the library drawer. */}
        <button
          type="button"
          aria-label={libraryOpen ? 'Close library' : 'Add meter'}
          aria-pressed={libraryOpen}
          title={libraryOpen ? 'Close library' : 'Add meter'}
          onClick={() => setLibraryOpen((o) => !o)}
          onMouseDown={stopDrag}
          style={headerBtnStyle}
          data-testid="meter-group-add-meter"
        >
          <Plus size={14} />
        </button>

        {onRemove ? (
          <button
            type="button"
            className="workspace-tile-close"
            aria-label="Remove panel"
            title="Remove panel"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X size={12} />
          </button>
        ) : null}
      </div>

      {/* ── body — flex container, widgets share space ─────────────── */}
      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'auto',
          display: 'flex',
          flexDirection: config.direction,
          gap: 8,
          padding: 10,
          alignItems: 'stretch',
          justifyContent:
            config.widgets.length === 0 ? 'center' : 'flex-start',
        }}
      >
        {config.widgets.length === 0 ? (
          <div
            style={{
              color: 'var(--fg-3)',
              fontSize: 12,
              fontFamily: 'var(--font-sans)',
              fontStyle: 'italic',
              textAlign: 'center',
              padding: 24,
            }}
            data-testid="meter-group-empty-state"
          >
            Empty group — tap + to add a meter.
          </div>
        ) : (
          config.widgets.map((w) => (
            <div
              key={w.uid}
              data-widget-uid={w.uid}
              onMouseEnter={() => setHoveredUid(w.uid)}
              onMouseLeave={() =>
                setHoveredUid((cur) => (cur === w.uid ? null : cur))
              }
              style={{
                position: 'relative',
                flex: '1 1 0',
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
              }}
            >
              <MeterRenderer widget={w} />
              {/* Hover-reveal trash — keeps gauges clean at rest. */}
              <button
                type="button"
                aria-label="Remove meter"
                title="Remove meter"
                onClick={(e) => {
                  e.stopPropagation();
                  removeWidget(w.uid);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  ...overlayBtnStyle,
                  opacity: hoveredUid === w.uid ? 1 : 0,
                  pointerEvents: hoveredUid === w.uid ? 'auto' : 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--tx)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--fg-2)';
                }}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* ── library drawer ─────────────────────────────────────────── */}
      <LibraryDrawer
        open={libraryOpen}
        onAdd={addWidget}
        onClose={() => setLibraryOpen(false)}
      />
    </div>
  );
}
