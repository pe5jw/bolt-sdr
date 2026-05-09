// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GROUP_UID,
  DEFAULT_WIDGET_SPAN,
  appendGroup,
  defaultWidgetForReading,
  EMPTY_METERS_CONFIG,
  newWidgetUid,
  parseMetersPanelConfig,
  placeWidgetInGrid,
  reassignWidgetToGroup,
  removeGroup,
  widgetKindAllowed,
  type MetersPanelConfig,
  type MetersWidgetInstance,
} from '../metersConfig';
import { METER_CATALOG, MeterReadingId } from '../meterCatalog';

function makeSampleConfig(): MetersPanelConfig {
  return {
    schemaVersion: 2,
    title: 'My Stack',
    groups: [{ uid: DEFAULT_GROUP_UID, title: 'Meters', order: 0 }],
    widgets: [
      {
        uid: 'a',
        reading: MeterReadingId.RxSignalPk,
        kind: 'hbar',
        settings: { peakHold: true, label: 'Signal' },
        groupUid: DEFAULT_GROUP_UID,
      },
      {
        uid: 'b',
        reading: MeterReadingId.TxFwdWatts,
        // Catalog default after the immersive rework. The legacy
        // dial → bigarc migration is exercised by a dedicated test
        // further down.
        kind: 'bigarc',
        settings: { min: 0, max: 5 },
        groupUid: DEFAULT_GROUP_UID,
      },
      {
        uid: 'c',
        reading: MeterReadingId.TxSwr,
        kind: 'digital',
        settings: {},
        groupUid: DEFAULT_GROUP_UID,
      },
    ],
  };
}

describe('metersConfig', () => {
  it('defaults to schemaVersion 2 with no widgets and the synthetic default group', () => {
    expect(EMPTY_METERS_CONFIG.schemaVersion).toBe(2);
    expect(EMPTY_METERS_CONFIG.widgets).toEqual([]);
    expect(EMPTY_METERS_CONFIG.groups.length).toBe(1);
    expect(EMPTY_METERS_CONFIG.groups[0]?.uid).toBe(DEFAULT_GROUP_UID);
  });

  it('round-trips a populated config through JSON 5+ times unchanged', () => {
    const original = makeSampleConfig();
    let blob: unknown = original;
    for (let i = 0; i < 6; i++) {
      blob = parseMetersPanelConfig(JSON.parse(JSON.stringify(blob)));
    }
    expect(blob).toEqual(original);
  });

  it('drops widgets that reference unknown readings', () => {
    const dirty = {
      schemaVersion: 1,
      widgets: [
        {
          uid: 'ok',
          reading: MeterReadingId.TxSwr,
          kind: 'digital',
          settings: {},
        },
        // bogus
        {
          uid: 'nope',
          reading: 'rx.does-not-exist',
          kind: 'hbar',
          settings: {},
        },
      ],
    };
    const parsed = parseMetersPanelConfig(dirty);
    expect(parsed.widgets.length).toBe(1);
    expect(parsed.widgets[0]?.uid).toBe('ok');
  });

  it('returns EMPTY_METERS_CONFIG for non-object / missing input', () => {
    expect(parseMetersPanelConfig(null)).toEqual(EMPTY_METERS_CONFIG);
    expect(parseMetersPanelConfig(undefined)).toEqual(EMPTY_METERS_CONFIG);
    expect(parseMetersPanelConfig(42)).toEqual(EMPTY_METERS_CONFIG);
    expect(parseMetersPanelConfig('hello')).toEqual(EMPTY_METERS_CONFIG);
  });

  it('returns EMPTY_METERS_CONFIG when schemaVersion mismatches', () => {
    const future = { schemaVersion: 99, widgets: [] };
    expect(parseMetersPanelConfig(future)).toEqual(EMPTY_METERS_CONFIG);
  });

  it('drops widgets with invalid kind', () => {
    const dirty = {
      schemaVersion: 1,
      widgets: [
        {
          uid: 'bad-kind',
          reading: MeterReadingId.TxSwr,
          kind: 'spinner',
          settings: {},
        },
      ],
    };
    const parsed = parseMetersPanelConfig(dirty);
    expect(parsed.widgets).toHaveLength(0);
  });

  it('newWidgetUid returns a non-empty string each call', () => {
    const a = newWidgetUid();
    const b = newWidgetUid();
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it('defaultWidgetForReading uses the catalog defaultKind', () => {
    const w = defaultWidgetForReading(MeterReadingId.TxFwdWatts);
    expect(w.kind).toBe('bigarc');
    expect(w.reading).toBe(MeterReadingId.TxFwdWatts);
    expect(w.settings).toEqual({});
  });

  it('preserves an operator title across round-trip', () => {
    const cfg = makeSampleConfig();
    const json = JSON.stringify(cfg);
    const back = parseMetersPanelConfig(JSON.parse(json));
    expect(back.title).toBe('My Stack');
  });

  it('round-trips a widget layout (x/y/w/h) through JSON', () => {
    const cfg: MetersPanelConfig = {
      schemaVersion: 2,
      groups: [{ uid: DEFAULT_GROUP_UID, title: 'Meters', order: 0 }],
      widgets: [
        {
          uid: 'p1',
          reading: MeterReadingId.TxFwdWatts,
          kind: 'bigarc',
          settings: {},
          groupUid: DEFAULT_GROUP_UID,
          layout: { x: 4, y: 2, w: 3, h: 4 },
        },
      ],
    };
    const back = parseMetersPanelConfig(JSON.parse(JSON.stringify(cfg)));
    expect(back.widgets[0]?.layout).toEqual({ x: 4, y: 2, w: 3, h: 4 });
  });

  it('placeWidgetInGrid assigns next-row layout to a widget that lacks one', () => {
    // All existing widgets share the same group as the fresh widget so the
    // group-aware filter inside placeWidgetInGrid picks them up. Cross-
    // group exclusion is covered by a separate test below.
    const existing: MetersWidgetInstance[] = [
      {
        uid: 'a',
        reading: MeterReadingId.RxSignalPk,
        kind: 'hbar',
        settings: {},
        groupUid: DEFAULT_GROUP_UID,
        layout: { x: 0, y: 0, w: 6, h: 2 },
      },
      {
        uid: 'b',
        reading: MeterReadingId.TxSwr,
        kind: 'digital',
        settings: {},
        groupUid: DEFAULT_GROUP_UID,
        layout: { x: 6, y: 0, w: 3, h: 2 },
      },
    ];
    const fresh = defaultWidgetForReading(MeterReadingId.TxFwdWatts);
    expect(fresh.layout).toBeUndefined();
    const placed = placeWidgetInGrid(fresh, existing);
    expect(placed.layout?.y).toBe(2); // next free row below the existing pair
    expect(placed.layout?.x).toBe(0);
    expect(placed.layout?.w).toBe(DEFAULT_WIDGET_SPAN.bigarc.w);
    expect(placed.layout?.h).toBe(DEFAULT_WIDGET_SPAN.bigarc.h);
  });

  it('placeWidgetInGrid is a no-op for a widget that already has a layout', () => {
    const widget: MetersWidgetInstance = {
      uid: 'has-layout',
      reading: MeterReadingId.TxAlcGr,
      kind: 'hbar',
      settings: {},
      layout: { x: 1, y: 2, w: 3, h: 4 },
    };
    expect(placeWidgetInGrid(widget, [])).toBe(widget);
  });

  it('migrates legacy kind "dial" to "bigarc" on parse', () => {
    const legacy = {
      schemaVersion: 1,
      widgets: [
        {
          uid: 'fwd',
          reading: MeterReadingId.TxFwdWatts,
          kind: 'dial',
          settings: { max: 100 },
        },
      ],
    };
    const parsed = parseMetersPanelConfig(legacy);
    expect(parsed.widgets.length).toBe(1);
    expect(parsed.widgets[0]?.kind).toBe('bigarc');
    // Widget metadata must survive the migration.
    expect(parsed.widgets[0]?.uid).toBe('fwd');
    expect(parsed.widgets[0]?.settings).toEqual({ max: 100 });
  });

  it('migrates legacy "vbar" on a dBFS reading to "vucolumn"', () => {
    const legacy = {
      schemaVersion: 1,
      widgets: [
        {
          uid: 'mic',
          reading: MeterReadingId.TxMicPk,
          kind: 'vbar',
          settings: {},
        },
      ],
    };
    const parsed = parseMetersPanelConfig(legacy);
    expect(parsed.widgets[0]?.kind).toBe('vucolumn');
  });

  it('migrates legacy "vbar" on a non-dBFS reading to "hbar" fallback', () => {
    // RxSignalPk is dBm — VuColumn's fixed dBFS axis would not fit, so the
    // migrator must fall back to the always-allowed hbar primitive.
    const legacy = {
      schemaVersion: 1,
      widgets: [
        {
          uid: 'sig',
          reading: MeterReadingId.RxSignalPk,
          kind: 'vbar',
          settings: {},
        },
      ],
    };
    const parsed = parseMetersPanelConfig(legacy);
    expect(parsed.widgets[0]?.kind).toBe('hbar');
  });

  it('widgetKindAllowed: bigarc rejects dBm, accepts watts/ratio/dBFS', () => {
    const rxAgcEnvPk = METER_CATALOG[MeterReadingId.RxAgcEnvPk]; // dBm
    const txFwd = METER_CATALOG[MeterReadingId.TxFwdWatts]; // W
    const txSwr = METER_CATALOG[MeterReadingId.TxSwr]; // ratio
    const txMicPk = METER_CATALOG[MeterReadingId.TxMicPk]; // dBFS
    expect(widgetKindAllowed('bigarc', rxAgcEnvPk)).toBe(false);
    expect(widgetKindAllowed('bigarc', txFwd)).toBe(true);
    expect(widgetKindAllowed('bigarc', txSwr)).toBe(true);
    expect(widgetKindAllowed('bigarc', txMicPk)).toBe(true);
  });

  it('widgetKindAllowed: pulldown only accepts gain-reduction readings', () => {
    const txAlcGr = METER_CATALOG[MeterReadingId.TxAlcGr]; // tx-protection
    const txMicPk = METER_CATALOG[MeterReadingId.TxMicPk]; // tx-stage
    const rxSig = METER_CATALOG[MeterReadingId.RxSignalPk]; // rx-signal
    expect(widgetKindAllowed('pulldown', txAlcGr)).toBe(true);
    expect(widgetKindAllowed('pulldown', txMicPk)).toBe(false);
    expect(widgetKindAllowed('pulldown', rxSig)).toBe(false);
  });

  it('widgetKindAllowed: vucolumn restricted to dBFS readings', () => {
    const rxAdc = METER_CATALOG[MeterReadingId.RxAdcPk]; // dBFS
    const txMicPk = METER_CATALOG[MeterReadingId.TxMicPk]; // dBFS
    const txAlcGr = METER_CATALOG[MeterReadingId.TxAlcGr]; // dB (not dBFS)
    expect(widgetKindAllowed('vucolumn', rxAdc)).toBe(true);
    expect(widgetKindAllowed('vucolumn', txMicPk)).toBe(true);
    expect(widgetKindAllowed('vucolumn', txAlcGr)).toBe(false);
  });

  it('widgetKindAllowed: hbar/sparkline/digital are always allowed', () => {
    for (const def of Object.values(METER_CATALOG)) {
      expect(widgetKindAllowed('hbar', def)).toBe(true);
      expect(widgetKindAllowed('sparkline', def)).toBe(true);
      expect(widgetKindAllowed('digital', def)).toBe(true);
    }
  });

  // ─── schema v2 / groups ──────────────────────────────────────────

  it('parses a v1 config and synthesises the default group', () => {
    const v1 = {
      schemaVersion: 1,
      widgets: [
        {
          uid: 'a',
          reading: MeterReadingId.TxFwdWatts,
          kind: 'bigarc',
          settings: {},
        },
        {
          uid: 'b',
          reading: MeterReadingId.TxSwr,
          kind: 'digital',
          settings: {},
        },
      ],
    };
    const parsed = parseMetersPanelConfig(v1);
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.groups.length).toBe(1);
    expect(parsed.groups[0]?.uid).toBe(DEFAULT_GROUP_UID);
    // Every legacy widget binds to the synthetic default group on first
    // open — no orphans.
    for (const w of parsed.widgets) {
      expect(w.groupUid).toBe(DEFAULT_GROUP_UID);
    }
  });

  it('round-trips a v2 config with multiple groups intact', () => {
    const cfg: MetersPanelConfig = {
      schemaVersion: 2,
      title: 'Two-group stack',
      groups: [
        { uid: DEFAULT_GROUP_UID, title: 'Output', order: 0 },
        { uid: 'g2', title: 'Chain', order: 1, collapsed: true },
      ],
      widgets: [
        {
          uid: 'w1',
          reading: MeterReadingId.TxFwdWatts,
          kind: 'bigarc',
          settings: {},
          groupUid: DEFAULT_GROUP_UID,
        },
        {
          uid: 'w2',
          reading: MeterReadingId.TxMicPk,
          kind: 'vucolumn',
          settings: {},
          groupUid: 'g2',
        },
      ],
    };
    const back = parseMetersPanelConfig(JSON.parse(JSON.stringify(cfg)));
    expect(back.groups.length).toBe(2);
    expect(back.groups[0]?.title).toBe('Output');
    expect(back.groups[1]?.title).toBe('Chain');
    expect(back.groups[1]?.collapsed).toBe(true);
    expect(back.widgets.find((w) => w.uid === 'w1')?.groupUid).toBe(
      DEFAULT_GROUP_UID,
    );
    expect(back.widgets.find((w) => w.uid === 'w2')?.groupUid).toBe('g2');
  });

  it('reassigns widgets with unknown groupUid to the lowest-order group', () => {
    const dirty = {
      schemaVersion: 2,
      groups: [
        { uid: 'first', title: 'First', order: 0 },
        { uid: 'second', title: 'Second', order: 1 },
      ],
      widgets: [
        {
          uid: 'orphan',
          reading: MeterReadingId.TxSwr,
          kind: 'bigarc',
          settings: {},
          groupUid: 'never-existed',
        },
      ],
    };
    const parsed = parseMetersPanelConfig(dirty);
    expect(parsed.widgets[0]?.groupUid).toBe('first');
  });

  it('appendGroup inserts a new group with monotonically increasing order', () => {
    const base = makeSampleConfig();
    const { config: next, group } = appendGroup(base, 'Chain');
    expect(next.groups.length).toBe(2);
    expect(group.title).toBe('Chain');
    expect(group.order).toBeGreaterThan(0);
    // Original config must NOT be mutated — appendGroup is a pure helper.
    expect(base.groups.length).toBe(1);
  });

  it('removeGroup is a no-op when only one group remains', () => {
    const cfg = makeSampleConfig();
    expect(cfg.groups.length).toBe(1);
    const after = removeGroup(cfg, cfg.groups[0]!.uid);
    expect(after).toBe(cfg);
  });

  it('removeGroup reassigns widgets to the lowest-order remaining group and clears their layout', () => {
    const cfg: MetersPanelConfig = {
      schemaVersion: 2,
      groups: [
        { uid: 'first', title: 'First', order: 0 },
        { uid: 'doomed', title: 'Doomed', order: 1 },
      ],
      widgets: [
        {
          uid: 'survivor',
          reading: MeterReadingId.TxSwr,
          kind: 'bigarc',
          settings: {},
          groupUid: 'doomed',
          layout: { x: 4, y: 4, w: 4, h: 4 },
        },
      ],
    };
    const after = removeGroup(cfg, 'doomed');
    expect(after.groups.length).toBe(1);
    expect(after.groups[0]?.uid).toBe('first');
    const moved = after.widgets[0]!;
    expect(moved.groupUid).toBe('first');
    // Layout cleared so RGL re-flows in the destination canvas.
    expect(moved.layout).toBeUndefined();
    // Other widget metadata preserved.
    expect(moved.uid).toBe('survivor');
    expect(moved.kind).toBe('bigarc');
  });

  it('reassignWidgetToGroup updates groupUid and clears layout', () => {
    const cfg: MetersPanelConfig = {
      schemaVersion: 2,
      groups: [
        { uid: 'a', title: 'A', order: 0 },
        { uid: 'b', title: 'B', order: 1 },
      ],
      widgets: [
        {
          uid: 'w',
          reading: MeterReadingId.TxFwdWatts,
          kind: 'bigarc',
          settings: { max: 100 },
          groupUid: 'a',
          layout: { x: 0, y: 0, w: 4, h: 4 },
        },
      ],
    };
    const after = reassignWidgetToGroup(cfg, 'w', 'b');
    expect(after.widgets[0]?.groupUid).toBe('b');
    expect(after.widgets[0]?.layout).toBeUndefined();
    // Settings + kind + reading + uid preserved across the cross-group move.
    expect(after.widgets[0]?.settings).toEqual({ max: 100 });
    expect(after.widgets[0]?.kind).toBe('bigarc');
    expect(after.widgets[0]?.uid).toBe('w');
  });

  it('reassignWidgetToGroup is a no-op for an unknown target group', () => {
    const cfg = makeSampleConfig();
    const after = reassignWidgetToGroup(cfg, 'b', 'no-such-group');
    expect(after).toBe(cfg);
  });

  it('placeWidgetInGrid considers only widgets in the same group', () => {
    const inOtherGroup: MetersWidgetInstance[] = [
      {
        uid: 'a',
        reading: MeterReadingId.RxSignalPk,
        kind: 'hbar',
        settings: {},
        groupUid: 'group-a',
        layout: { x: 0, y: 0, w: 12, h: 6 },
      },
    ];
    const fresh = defaultWidgetForReading(MeterReadingId.TxFwdWatts, 'group-b');
    const placed = placeWidgetInGrid(fresh, inOtherGroup);
    // Should land at y=0 inside group-b — group-a's tall widget doesn't
    // push it down, since it's a separate canvas.
    expect(placed.layout?.y).toBe(0);
  });
});
