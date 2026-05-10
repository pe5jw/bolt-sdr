// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// Add Meter modal — popover variant of the meter library, modelled on
// the workspace's `AddPanelModal`. Used in place of an inline slide-in
// drawer because the Meter Group tile is often too narrow for an
// over-the-content drawer to be usable; a centred modal floats above
// the workspace instead.
//
// UX matches AddPanelModal: left rail of category chips ("All / RX / TX
// / Power / Stage / AGC"), right pane with search input + scrollable
// list of reading cards. Click a card → adds that reading to the panel
// and closes the modal. Reuses the `add-panel-modal*` CSS classes for
// visual parity (header, rail, search, card grid).

import { useState } from 'react';
import {
  METER_CATALOG,
  METER_FILTERS,
  meterMatchesFilter,
  type MeterFilter,
  type MeterReadingId,
} from '../meters/meterCatalog';

interface AddMeterModalProps {
  /** Reading ids already in the active group. Used to flag duplicates
   *  with a "+ Add another" badge — meter groups happily host the same
   *  reading twice (e.g. one BigArc + one Digital), so we don't filter
   *  them out, just label them. */
  existingReadings: Set<string>;
  onAdd: (id: MeterReadingId) => void;
  onClose: () => void;
}

const FILTER_LABEL: Record<MeterFilter, string> = {
  all: 'All',
  rx: 'RX',
  tx: 'TX',
  power: 'Power',
  stage: 'Stage',
  agc: 'AGC',
};

export function AddMeterModal({
  existingReadings,
  onAdd,
  onClose,
}: AddMeterModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<MeterFilter>('all');

  const items = Object.values(METER_CATALOG).filter((def) => {
    if (!meterMatchesFilter(def, selectedFilter)) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        def.label.toLowerCase().includes(term) ||
        def.short.toLowerCase().includes(term) ||
        def.id.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        className="add-panel-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Add meter"
        data-testid="add-meter-modal"
      >
        <div className="add-panel-modal-header">
          <h2>Add Meter</h2>
          <button
            type="button"
            className="workspace-tile-close"
            aria-label="Close add-meter modal"
            onClick={onClose}
            style={{ width: 22, height: 22 }}
          >
            ×
          </button>
        </div>

        <div className="add-panel-modal-rail" data-testid="add-meter-rail">
          {METER_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className="add-panel-category-btn"
              aria-pressed={selectedFilter === f}
              onClick={() => setSelectedFilter(f)}
              data-testid={`add-meter-filter-${f}`}
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>

        <div className="add-panel-modal-body">
          <input
            type="text"
            className="add-panel-search"
            placeholder="Search meters…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search meters"
          />

          <div className="add-panel-cards" data-testid="add-meter-cards">
            {items.length === 0 ? (
              <div className="add-panel-empty">No meters match</div>
            ) : (
              items.map((def) => {
                const showMultiBadge = existingReadings.has(def.id);
                return (
                  <button
                    key={def.id}
                    type="button"
                    className="add-panel-card"
                    data-meter-id={def.id}
                    onClick={() => {
                      onAdd(def.id);
                      onClose();
                    }}
                  >
                    <span className="add-panel-card-title">
                      {def.label}
                      {showMultiBadge && (
                        <span className="add-panel-card-title-multi">
                          + Add another
                        </span>
                      )}
                    </span>
                    <span className="add-panel-card-tags">
                      {def.category} · {def.unit} · {def.defaultKind}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
