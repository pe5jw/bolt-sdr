// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// See ATTRIBUTIONS.md at the repository root for the full provenance
// statement and per-component attribution.

// Display-side meter calibration knobs (GitHub #426). Currently surfaces
// the S-meter dB offset trim. Persisted server-side in zeus-prefs.db.

export const SMETER_OFFSET_MIN_DB = -20;
export const SMETER_OFFSET_MAX_DB = 20;
export const SMETER_OFFSET_DEFAULT_DB = 0;

export type MeterDisplaySettings = {
  sMeterOffsetDb: number;
};

type RawDto = {
  sMeterOffsetDb?: number;
};

function clampOffset(v: number): number {
  if (!Number.isFinite(v)) return SMETER_OFFSET_DEFAULT_DB;
  if (v < SMETER_OFFSET_MIN_DB) return SMETER_OFFSET_MIN_DB;
  if (v > SMETER_OFFSET_MAX_DB) return SMETER_OFFSET_MAX_DB;
  return v;
}

function normalize(raw: RawDto): MeterDisplaySettings {
  return {
    sMeterOffsetDb: clampOffset(
      typeof raw.sMeterOffsetDb === 'number' ? raw.sMeterOffsetDb : SMETER_OFFSET_DEFAULT_DB,
    ),
  };
}

export async function fetchMeterDisplaySettings(
  signal?: AbortSignal,
): Promise<MeterDisplaySettings> {
  const res = await fetch('/api/meters/display-settings', { signal });
  if (!res.ok) throw new Error(`GET /api/meters/display-settings → ${res.status}`);
  return normalize((await res.json()) as RawDto);
}

export async function updateSMeterOffsetDb(
  offsetDb: number,
  signal?: AbortSignal,
): Promise<MeterDisplaySettings> {
  const res = await fetch('/api/meters/smeter-offset-db', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ offsetDb: clampOffset(offsetDb) }),
    signal,
  });
  if (!res.ok) throw new Error(`PUT /api/meters/smeter-offset-db → ${res.status}`);
  return normalize((await res.json()) as RawDto);
}
