// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// Per-instance Meters-tile configuration. The blob lives in the FlexLayout
// `TabNode.config` field, round-trips with `Model.toJson()` via the existing
// /api/ui/layout PUT path, and survives full-browser restarts. No new
// storage layer.
//
// Mutating a panel's config goes through `Actions.updateNodeAttributes`,
// which fires `onModelChange` on the FlexWorkspace, which writes the layout
// JSON back to `useLayoutStore` and triggers the debounced server PUT.

import { MeterReadingId, METER_CATALOG, type MeterReadingDef } from './meterCatalog';

/** Operator-overridable rendering knobs. All fields optional — defaults come
 *  from `METER_CATALOG[reading]` at render time. */
export interface WidgetSettings {
  /** Axis-min override. */
  min?: number;
  /** Axis-max override. */
  max?: number;
  /** Whether to render the peak-hold tick. Defaults to true for level/dBFS
   *  readings and false for digital-style readings. */
  peakHold?: boolean;
  /** Operator-friendly label override. */
  label?: string;
}

/** Widget renderer kinds available to the configurable Meters Panel. The
 *  three "immersive" entries (`bigarc` / `vucolumn` / `pulldown`) render
 *  the same SVG primitives used by the TX Stage Meters panel, so the look
 *  matches across both meter surfaces. The legacy `dial` and `vbar` kinds
 *  are gone from the union — operator workspaces still containing them
 *  auto-migrate at parse time (see `parseMetersPanelConfig` below). */
export type MetersWidgetKind =
  | 'bigarc'
  | 'vucolumn'
  | 'pulldown'
  | 'hbar'
  | 'sparkline'
  | 'digital';

export const METERS_WIDGET_KINDS: ReadonlyArray<MetersWidgetKind> = [
  'bigarc',
  'vucolumn',
  'pulldown',
  'hbar',
  'sparkline',
  'digital',
];

/** Kinds the parser recognises but no longer ships in the renderer
 *  dispatch; their values are remapped to a current kind on read. Stays
 *  separate from the live union so TS keeps callers honest about which
 *  kinds the dispatch must handle. */
const LEGACY_KINDS = new Set(['dial', 'vbar']);

/** Whether a given widget kind is sensible for a given reading. The
 *  Settings drawer uses this to grey-out incompatible kinds in the kind
 *  picker (still rendered for discoverability — operators see what's
 *  possible, just can't pick it). The parser uses the same predicate to
 *  pick the migration fallback when a legacy `vbar` lands on a non-dBFS
 *  reading or a `dial` lands on a dBm meter.
 *
 *  The rules are deliberately narrow: each immersive primitive has a
 *  fixed axis convention (BigArc = W/ratio/dBFS; VuColumn = dBFS LED
 *  column; PullDownArc = right-anchored GR), and forcing the wrong unit
 *  through them produces a meter that reads consistently wrong. The
 *  three legacy kinds (`hbar` / `sparkline` / `digital`) accept any
 *  unit and so are always allowed. */
export function widgetKindAllowed(
  kind: MetersWidgetKind,
  def: MeterReadingDef,
): boolean {
  switch (kind) {
    case 'bigarc':
      // Linear-axis gauge: watts ramp, SWR ratio, or 0..max dBFS modulator.
      // dBm signal-strength has too wide a span to fit BigArc's fixed dBFS
      // axis, and signed dB swings (e.g. RxAgcGain ±40..60) don't fit
      // either of BigArc's three modes.
      return def.unit === 'W' || def.unit === 'ratio' || def.unit === 'dBFS';
    case 'vucolumn':
      // Vertical LED column with a dBFS log axis. Restricted to dBFS so
      // the side-tick numerals (0/-3/-6/-10/-20/-40/-60 dB) stay
      // meaningful and the dashed 0 dBFS reference line lands correctly.
      return def.unit === 'dBFS';
    case 'pulldown':
      // Right-anchored "leveler is pulling the chain down" arc. Only
      // makes semantic sense for the GR (gain-reduction) readings.
      return def.category === 'tx-protection';
    case 'hbar':
    case 'sparkline':
    case 'digital':
      return true;
  }
}

/** Translate a legacy widget kind to the current equivalent. Falls back to
 *  `'hbar'` when the immersive replacement isn't compatible with the
 *  reading (e.g. a legacy `vbar` on a dBm signal-strength meter would not
 *  fit `vucolumn`'s dBFS axis — it becomes `hbar` instead). Returns null
 *  for an unknown legacy kind so the parser can drop the widget. */
function migrateLegacyKind(
  legacy: string,
  def: MeterReadingDef,
): MetersWidgetKind | null {
  switch (legacy) {
    case 'dial':
      return widgetKindAllowed('bigarc', def) ? 'bigarc' : 'hbar';
    case 'vbar':
      return widgetKindAllowed('vucolumn', def) ? 'vucolumn' : 'hbar';
    default:
      return null;
  }
}

/** Grid-cell placement within the canvas's 12-column grid (react-grid-layout
 *  coordinates). x/y are integer column/row; w/h are integer column/row spans.
 *  Optional on the wire — widgets without it get auto-placed at the next free
 *  row on first render and the placement persisted back. */
export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A single configured widget inside a Meters tile. */
export interface MetersWidgetInstance {
  /** Stable per-widget id. Survives re-orders so React keys stay aligned and
   *  Settings-drawer "selected widget" tracking doesn't lose its referent. */
  uid: string;
  /** What to read. */
  reading: MeterReadingId;
  /** How to render. */
  kind: MetersWidgetKind;
  /** Operator overrides on top of catalog defaults. */
  settings: WidgetSettings;
  /** Persisted grid placement. Optional for forward/backward compat. */
  layout?: WidgetLayout;
}

/** 12-column grid, fixed row height, used by react-grid-layout. */
export const METERS_GRID_COLS = 12;
export const METERS_GRID_ROW_HEIGHT_PX = 40;
/** Per-kind default span when a widget is first added (auto-layout).
 *  Footprints chosen to give each immersive primitive room for its
 *  intrinsic aspect: BigArc (~1.55:1, semicircle); VuColumn (tall LED
 *  column); PullDownArc (~1.30:1 horizontal arc). */
export const DEFAULT_WIDGET_SPAN: Record<MetersWidgetKind, { w: number; h: number }> = {
  bigarc: { w: 4, h: 4 },
  vucolumn: { w: 2, h: 5 },
  pulldown: { w: 4, h: 4 },
  hbar: { w: 6, h: 2 },
  sparkline: { w: 8, h: 3 },
  digital: { w: 3, h: 2 },
};

/** Top-level config blob for one Meters tile instance. */
export interface MetersPanelConfig {
  /** Bumped whenever the schema gains a non-additive field. v2+ migrations
   *  must check this before reading legacy fields; unknown versions reset
   *  to `EMPTY_METERS_CONFIG`. */
  schemaVersion: 1;
  widgets: MetersWidgetInstance[];
  /** Optional operator-named instance, shown in the panel header. Falls back
   *  to "Meters" when absent. */
  title?: string;
}

export const EMPTY_METERS_CONFIG: MetersPanelConfig = {
  schemaVersion: 1,
  widgets: [],
};

/** Best-effort parse + validation of the opaque `node.getConfig()` blob.
 *  Anything malformed falls through to the empty config — never throws,
 *  never crashes the panel. */
export function parseMetersPanelConfig(raw: unknown): MetersPanelConfig {
  if (!raw || typeof raw !== 'object') return EMPTY_METERS_CONFIG;
  const obj = raw as Partial<MetersPanelConfig>;
  if (obj.schemaVersion !== 1) return EMPTY_METERS_CONFIG;
  const widgets = Array.isArray(obj.widgets) ? obj.widgets : [];
  // Filter out entries whose `reading` is no longer in the catalog (e.g. a
  // future schema removed an ID). A Meters tile that lost a widget is far
  // less surprising than one that crashes the whole panel.
  const validWidgets: MetersWidgetInstance[] = [];
  const currentKindSet = new Set<string>(METERS_WIDGET_KINDS);
  for (const w of widgets) {
    if (!w || typeof w !== 'object') continue;
    const widget = w as Partial<MetersWidgetInstance> & { kind?: unknown };
    if (typeof widget.uid !== 'string') continue;
    if (typeof widget.reading !== 'string') continue;
    if (!(widget.reading in METER_CATALOG)) continue;
    const rawKind = widget.kind;
    if (typeof rawKind !== 'string') continue;
    const isCurrent = currentKindSet.has(rawKind);
    const isLegacy = LEGACY_KINDS.has(rawKind);
    if (!isCurrent && !isLegacy) continue;
    const def = METER_CATALOG[widget.reading as MeterReadingId];
    let kind: MetersWidgetKind;
    if (isCurrent) {
      kind = rawKind as MetersWidgetKind;
    } else {
      // Legacy kind — migrate forward; drop widget if the legacy kind has
      // no current equivalent (defensive: should never happen given the
      // LEGACY_KINDS set, but keeps the parser total).
      const migrated = migrateLegacyKind(rawKind, def);
      if (!migrated) continue;
      kind = migrated;
    }
    const layoutRaw = (widget as { layout?: unknown }).layout;
    let layout: WidgetLayout | undefined;
    if (layoutRaw && typeof layoutRaw === 'object') {
      const l = layoutRaw as Partial<WidgetLayout>;
      if (
        Number.isFinite(l.x) &&
        Number.isFinite(l.y) &&
        Number.isFinite(l.w) &&
        Number.isFinite(l.h)
      ) {
        layout = { x: l.x as number, y: l.y as number, w: l.w as number, h: l.h as number };
      }
    }
    validWidgets.push({
      uid: widget.uid,
      reading: widget.reading as MeterReadingId,
      kind,
      settings:
        widget.settings && typeof widget.settings === 'object'
          ? { ...widget.settings }
          : {},
      ...(layout ? { layout } : {}),
    });
  }
  return {
    schemaVersion: 1,
    widgets: validWidgets,
    title: typeof obj.title === 'string' ? obj.title : undefined,
  };
}

/** Generate a stable, locally-unique widget UID. Uses crypto.randomUUID()
 *  when available; falls back to a Math.random suffix in old contexts. */
export function newWidgetUid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Default widget instance for a freshly-added catalog reading. */
export function defaultWidgetForReading(
  id: MeterReadingId,
): MetersWidgetInstance {
  const def = METER_CATALOG[id];
  return {
    uid: newWidgetUid(),
    reading: id,
    kind: def.defaultKind,
    settings: {},
  };
}

/** Compute a layout placement for a brand-new widget, given the existing
 *  set. Strategy: use the widget kind's default w/h, then place it at the
 *  next free row (y = max existing y+h, x = 0). The grid will compact it
 *  upward into any free space when react-grid-layout renders. */
export function placeWidgetInGrid(
  widget: MetersWidgetInstance,
  others: MetersWidgetInstance[],
): MetersWidgetInstance {
  if (widget.layout) return widget;
  const span = DEFAULT_WIDGET_SPAN[widget.kind];
  const maxY = others.reduce((m, w) => {
    if (!w.layout) return m;
    return Math.max(m, w.layout.y + w.layout.h);
  }, 0);
  return {
    ...widget,
    layout: { x: 0, y: maxY, w: span.w, h: span.h },
  };
}
