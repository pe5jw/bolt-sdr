// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.
//
// Licensed under the GNU General Public License v2.0-or-later. See the LICENSE
// file at the repository root for the full text.

import type { LogEntry } from '../../api/log';
import { useOperatorStore } from '../../state/operator-store';
import { countryToFlag } from './logbook-flag';
import { isQrzPublished } from './LogbookLive';

// The station-detail card for the popped-out Logbook workspace: the full read of
// the QSO focused in the table. Every value shown here is a real logged field.
// A few surfaces (QSL exchange, rig/antenna, tags, note editing) are the "next"
// features and render as honest, clearly-labelled empty states rather than
// fabricated data — see the linked follow-up issue in the workspace.

function fmtLongDateUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function fmtTimeUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
}

function fmtStampUtc(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${fmtLongDateUtc(iso)} ${fmtTimeUtc(iso)}`;
}

function fmtFreq(freq: number | null | undefined): string {
  return typeof freq === 'number' && Number.isFinite(freq) ? freq.toFixed(3) : '—';
}

function orDash(v: string | null | undefined): string {
  return v && v.trim() ? v : '—';
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="lbd-field">
      <span className="lbd-field-label">{label}</span>
      <span className={`lbd-field-value${mono ? ' mono' : ''}`}>{value}</span>
    </div>
  );
}

export function LogbookDetail({ entry }: { entry: LogEntry | null }) {
  const operatorCall = useOperatorStore((s) => s.resolvedCall);

  if (!entry) {
    return (
      <div className="lbd lbd--empty">
        <div className="lbd-empty-glyph" aria-hidden="true">◎</div>
        <div className="lbd-empty-copy">Select a QSO to see full station detail.</div>
      </div>
    );
  }

  const published = isQrzPublished(entry);
  const location = [entry.grid, entry.state, entry.country].filter(Boolean).join(' · ') || '—';
  const qrzUrl = `https://www.qrz.com/db/${encodeURIComponent(entry.callsign)}`;

  return (
    <div className="lbd">
      <div className="lbd-head">
        <div className="lbd-call">{entry.callsign}</div>
        {published && <span className="lbd-qrz-pill">✓ QRZ</span>}
      </div>

      <div className="lbd-station">
        <span className="lbd-flag" aria-hidden="true">{countryToFlag(entry.country)}</span>
        <div className="lbd-station-text">
          <div className="lbd-name">{orDash(entry.name)}</div>
          <div className="lbd-loc">{location}</div>
        </div>
      </div>

      <div className="lbd-primary">
        <div className="lbd-primary-fields">
          <Field label="Date" value={fmtLongDateUtc(entry.qsoDateTimeUtc)} mono />
          <Field label="Time (UTC)" value={`${fmtTimeUtc(entry.qsoDateTimeUtc)}Z`} mono />
          <Field label="Mode" value={orDash(entry.mode)} mono />
          <Field label="RST" value={`${orDash(entry.rstSent)} / ${orDash(entry.rstRcvd)}`} mono />
        </div>
        <div className="lbd-freq">
          <span className="lbd-freq-val mono">{fmtFreq(entry.frequencyMhz)}</span>
          <span className="lbd-freq-band mono">{orDash(entry.band)}</span>
        </div>
      </div>

      <div className="lbd-section">
        <div className="lbd-section-label">Notes</div>
        <div className={`lbd-note${entry.comment ? '' : ' lbd-note--empty'}`}>
          {entry.comment || 'No note recorded'}
        </div>
      </div>

      <div className="lbd-section">
        <div className="lbd-section-label">Tags</div>
        <div className="lbd-tags-empty" title="QSO tags arrive in an upcoming Logbook update">
          Tagging coming soon
        </div>
      </div>

      <div className="lbd-section">
        <div className="lbd-section-label">QSL Info</div>
        <div className="lbd-grid2">
          <Field label="QSL Sent" value="Not Sent" />
          <Field label="QSL Received" value="Not Received" />
          <Field label="Rig" value="—" />
          <Field label="Antenna" value="—" />
        </div>
      </div>

      <div className="lbd-section">
        <div className="lbd-grid3">
          <Field label="Grid" value={orDash(entry.grid)} mono />
          <Field label="ITU Zone" value={entry.ituZone != null ? String(entry.ituZone) : '—'} mono />
          <Field label="CQ Zone" value={entry.cqZone != null ? String(entry.cqZone) : '—'} mono />
        </div>
      </div>

      <div className="lbd-section">
        <div className="lbd-grid2">
          <Field label="Operator" value={orDash(operatorCall)} mono />
          <Field label="Source" value="Zeus Logbook" />
          <Field label="Added" value={fmtStampUtc(entry.createdUtc)} mono />
          <Field label="Country" value={orDash(entry.country)} />
        </div>
      </div>

      <div className="lbd-foot">
        <a className="lbd-qrz-link mono" href={qrzUrl} target="_blank" rel="noreferrer">
          QRZ.COM ↗
        </a>
      </div>
    </div>
  );
}
