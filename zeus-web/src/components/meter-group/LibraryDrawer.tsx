// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// Library drawer for the MeterGroup panel — slide-in side panel that lets
// the operator pick a catalog reading and add it to the current group.
// Stripped-down compared to the old MetersPanel library: no settings
// drawer (kind defaults from catalog; per-widget tweaks happen elsewhere
// later), no filter UI gymnastics — just a search box, category chips,
// and a flat list of readings.

import { useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import {
  METER_FILTERS,
  METER_READINGS,
  meterMatchesFilter,
  type MeterFilter,
  type MeterReadingId,
} from '../meters/meterCatalog';

interface LibraryDrawerProps {
  open: boolean;
  onAdd: (id: MeterReadingId) => void;
  onClose: () => void;
}

export function LibraryDrawer({ open, onAdd, onClose }: LibraryDrawerProps) {
  const [filter, setFilter] = useState<MeterFilter>('all');
  const [search, setSearch] = useState('');

  const term = search.trim().toLowerCase();
  const items = METER_READINGS.filter((def) => {
    if (!meterMatchesFilter(def, filter)) return false;
    if (term) {
      return (
        def.label.toLowerCase().includes(term) ||
        def.short.toLowerCase().includes(term) ||
        def.id.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const drawerStyle: CSSProperties = {
    position: 'absolute',
    top: 24,
    bottom: 0,
    right: 0,
    width: 260,
    background: 'var(--immersive-panel-2)',
    borderLeft: '1px solid var(--immersive-line)',
    boxShadow: 'var(--panel-shadow)',
    transform: open ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform var(--dur-med) var(--ease-out)',
    overflowY: 'auto',
    zIndex: 5,
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div
      role="dialog"
      aria-label="Add meter"
      aria-hidden={!open}
      style={drawerStyle}
      data-testid="meter-group-library"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: '1px solid var(--immersive-line)',
        }}
      >
        <span
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--fg-1)',
          }}
        >
          Add meter
        </span>
        <button
          type="button"
          aria-label="Close library"
          onClick={onClose}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: 18,
            color: 'var(--fg-2)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <X size={12} />
        </button>
      </div>

      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search meters"
          style={{
            padding: '4px 8px',
            background: 'var(--immersive-well-2)',
            border: '1px solid var(--immersive-line)',
            borderRadius: 'var(--r-xs)',
            color: 'var(--fg-0)',
            fontSize: 12,
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {METER_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              style={{
                padding: '2px 8px',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                borderRadius: 'var(--r-xs)',
                color: filter === f ? 'var(--btn-active-text)' : 'var(--fg-1)',
                background:
                  filter === f
                    ? 'linear-gradient(180deg, var(--btn-active-top), var(--btn-active-bot))'
                    : 'linear-gradient(180deg, var(--btn-top), var(--btn-bot))',
                border: '1px solid var(--btn-edge)',
                cursor: 'pointer',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 6px 8px' }}
        data-testid="meter-group-library-list"
      >
        {items.length === 0 ? (
          <div
            style={{
              padding: 16,
              fontSize: 11,
              color: 'var(--fg-2)',
              textAlign: 'center',
            }}
          >
            No meters match
          </div>
        ) : (
          items.map((def) => (
            <button
              key={def.id}
              type="button"
              onClick={() => onAdd(def.id)}
              title={`Add ${def.label}`}
              data-meter-id={def.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '5px 8px',
                margin: '2px 0',
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: 'var(--r-xs)',
                textAlign: 'left',
                color: 'var(--fg-1)',
                fontSize: 12,
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--immersive-well)';
                e.currentTarget.style.borderColor = 'var(--immersive-line)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <span>{def.label}</span>
              <span
                aria-hidden="true"
                style={{
                  fontSize: 9,
                  color: 'var(--fg-3)',
                  textTransform: 'uppercase',
                }}
              >
                + add
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
