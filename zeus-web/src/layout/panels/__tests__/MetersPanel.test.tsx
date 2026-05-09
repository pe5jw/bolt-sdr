// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.

/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import { render, act } from '../../../components/meters/__tests__/harness';
import { MetersPanelInner } from '../MetersPanel';
import {
  DEFAULT_GROUP_UID,
  EMPTY_METERS_CONFIG,
  type MetersPanelConfig,
} from '../../../components/meters/metersConfig';
import { MeterReadingId } from '../../../components/meters/meterCatalog';
import { createElement } from 'react';

interface State {
  current: MetersPanelConfig;
}

function setup(initial: MetersPanelConfig = EMPTY_METERS_CONFIG) {
  const state: State = { current: initial };
  const setConfig = (next: MetersPanelConfig) => {
    state.current = next;
    rerender();
  };
  const { container, rerender: rawRerender, unmount } = render(
    createElement(MetersPanelInner, {
      config: state.current,
      setConfig,
    }),
  );
  function rerender() {
    rawRerender(
      createElement(MetersPanelInner, {
        config: state.current,
        setConfig,
      }),
    );
  }
  return { state, container, rerender, unmount };
}

describe('MetersPanel', () => {
  it('renders the empty-state message when no widgets are configured', () => {
    const { container, unmount } = setup();
    const empty = container.querySelector('[data-testid="meters-empty-state"]');
    expect(empty).not.toBeNull();
    expect(empty?.textContent ?? '').toContain('No meters yet');
    unmount();
  });

  it('toggles the Library drawer via the gear button', () => {
    const { container, unmount } = setup();
    const drawer = container.querySelector(
      '[data-testid="meters-library-drawer"]',
    ) as HTMLElement | null;
    expect(drawer).not.toBeNull();
    expect(drawer?.getAttribute('aria-hidden')).toBe('true');

    const gear = container.querySelector(
      '[data-testid="meters-library-toggle"]',
    ) as HTMLButtonElement | null;
    expect(gear).not.toBeNull();
    act(() => {
      gear?.click();
    });
    expect(drawer?.getAttribute('aria-hidden')).toBe('false');

    act(() => {
      gear?.click();
    });
    expect(drawer?.getAttribute('aria-hidden')).toBe('true');
    unmount();
  });

  it('inserts a widget when a Library entry is clicked', () => {
    const { state, container, unmount } = setup();
    const gear = container.querySelector(
      '[data-testid="meters-library-toggle"]',
    ) as HTMLButtonElement | null;
    act(() => {
      gear?.click();
    });

    const fwdEntry = container.querySelector(
      `[data-meter-id="${MeterReadingId.TxFwdWatts}"]`,
    ) as HTMLButtonElement | null;
    expect(fwdEntry).not.toBeNull();
    act(() => {
      fwdEntry?.click();
    });

    expect(state.current.widgets.length).toBe(1);
    expect(state.current.widgets[0]?.reading).toBe(MeterReadingId.TxFwdWatts);
    // Catalog default for TxFwdWatts post-rework: BigArc (immersive watts).
    expect(state.current.widgets[0]?.kind).toBe('bigarc');
    unmount();
  });

  it('removes a widget when the Settings drawer remove button is clicked', () => {
    const initial: MetersPanelConfig = {
      schemaVersion: 2,
      groups: [{ uid: DEFAULT_GROUP_UID, title: 'Meters', order: 0 }],
      widgets: [
        {
          uid: 'w1',
          reading: MeterReadingId.TxSwr,
          kind: 'digital',
          settings: {},
          groupUid: DEFAULT_GROUP_UID,
        },
      ],
    };
    const { state, container, unmount } = setup(initial);

    // Click the widget body to select it (selection opens the Settings drawer).
    const widgetEl = container.querySelector(
      '[data-widget-uid="w1"]',
    ) as HTMLElement | null;
    expect(widgetEl).not.toBeNull();
    act(() => {
      widgetEl?.click();
    });

    const removeBtn = container.querySelector(
      '[data-testid="meters-remove-widget"]',
    ) as HTMLButtonElement | null;
    expect(removeBtn).not.toBeNull();
    act(() => {
      removeBtn?.click();
    });

    expect(state.current.widgets.length).toBe(0);
    unmount();
  });

  // ─── group operations (commit 3) ───────────────────────────────────

  it('renders a single synthetic group on an empty config', () => {
    const { container, unmount } = setup();
    const groups = container.querySelectorAll(
      '[data-testid="meters-group-section"]',
    );
    expect(groups.length).toBe(1);
    unmount();
  });

  it('"+ GROUP" header button creates a new group', () => {
    const { state, container, unmount } = setup();
    const addBtn = container.querySelector(
      '[data-testid="meters-add-group"]',
    ) as HTMLButtonElement | null;
    expect(addBtn).not.toBeNull();
    act(() => {
      addBtn?.click();
    });
    expect(state.current.groups.length).toBe(2);
    unmount();
  });

  it('"+ New group" canvas-bottom button also creates a group', () => {
    const { state, container, unmount } = setup();
    const bottomBtn = container.querySelector(
      '[data-testid="meters-add-group-bottom"]',
    ) as HTMLButtonElement | null;
    expect(bottomBtn).not.toBeNull();
    act(() => {
      bottomBtn?.click();
    });
    expect(state.current.groups.length).toBe(2);
    unmount();
  });

  it('library add lands in the most-recently-added (active) group', () => {
    const { state, container, unmount } = setup();
    // Add a second group; it becomes the active group.
    const addGroupBtn = container.querySelector(
      '[data-testid="meters-add-group"]',
    ) as HTMLButtonElement | null;
    act(() => {
      addGroupBtn?.click();
    });
    const newGroupUid = state.current.groups.find(
      (g) => g.uid !== DEFAULT_GROUP_UID,
    )?.uid;
    expect(newGroupUid).toBeDefined();
    // Open library and add a widget.
    const gear = container.querySelector(
      '[data-testid="meters-library-toggle"]',
    ) as HTMLButtonElement | null;
    act(() => {
      gear?.click();
    });
    const fwdEntry = container.querySelector(
      `[data-meter-id="${MeterReadingId.TxFwdWatts}"]`,
    ) as HTMLButtonElement | null;
    act(() => {
      fwdEntry?.click();
    });
    expect(state.current.widgets.length).toBe(1);
    expect(state.current.widgets[0]?.groupUid).toBe(newGroupUid);
    unmount();
  });

  it('removing a non-last group reassigns its widgets and clears their layout', () => {
    const initial: MetersPanelConfig = {
      schemaVersion: 2,
      groups: [
        { uid: 'first', title: 'First', order: 0 },
        { uid: 'doomed', title: 'Doomed', order: 1 },
      ],
      widgets: [
        {
          uid: 'mover',
          reading: MeterReadingId.TxFwdWatts,
          kind: 'bigarc',
          settings: {},
          groupUid: 'doomed',
          layout: { x: 0, y: 0, w: 4, h: 4 },
        },
      ],
    };
    const { state, container, unmount } = setup(initial);
    // Each group section renders its own remove-group button — the second
    // one (doomed) is the one we want to click.
    const removeButtons = Array.from(
      container.querySelectorAll('[data-testid="meters-remove-group"]'),
    ) as HTMLButtonElement[];
    expect(removeButtons.length).toBe(2);
    act(() => {
      removeButtons[1]?.click();
    });
    expect(state.current.groups.length).toBe(1);
    expect(state.current.widgets[0]?.groupUid).toBe('first');
    expect(state.current.widgets[0]?.layout).toBeUndefined();
    unmount();
  });

  it('the trash icon on the only remaining group is disabled', () => {
    const { container, unmount } = setup();
    const removeBtn = container.querySelector(
      '[data-testid="meters-remove-group"]',
    ) as HTMLButtonElement | null;
    expect(removeBtn).not.toBeNull();
    expect(removeBtn?.disabled).toBe(true);
    expect(removeBtn?.getAttribute('aria-disabled')).toBe('true');
    unmount();
  });

  it('cross-group drop reassigns groupUid and clears layout', () => {
    const initial: MetersPanelConfig = {
      schemaVersion: 2,
      groups: [
        { uid: 'src', title: 'Source', order: 0 },
        { uid: 'dst', title: 'Destination', order: 1 },
      ],
      widgets: [
        {
          uid: 'roamer',
          reading: MeterReadingId.TxSwr,
          kind: 'bigarc',
          settings: {},
          groupUid: 'src',
          layout: { x: 0, y: 0, w: 4, h: 4 },
        },
      ],
    };
    const { state, container, unmount } = setup(initial);

    const dstCanvas = container.querySelector(
      '[data-testid="meters-group-canvas"][data-group-uid="dst"]',
    ) as HTMLDivElement | null;
    expect(dstCanvas).not.toBeNull();

    // Synthesise an HTML5 drop event with the cross-group dataTransfer
    // mime — jsdom's DataTransfer is incomplete but a stub with a
    // .types array and a .getData function is enough to satisfy the
    // GroupSection drop handler.
    const dataMap = new Map<string, string>([
      ['application/x-zeus-meter-widget-uid', 'roamer'],
    ]);
    const dragEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dragEvent, 'dataTransfer', {
      value: {
        types: Array.from(dataMap.keys()),
        getData: (mime: string) => dataMap.get(mime) ?? '',
        setData: (mime: string, val: string) => {
          dataMap.set(mime, val);
        },
        dropEffect: 'move',
        effectAllowed: 'move',
      },
    });
    act(() => {
      dstCanvas?.dispatchEvent(dragEvent);
    });

    const moved = state.current.widgets.find((w) => w.uid === 'roamer');
    expect(moved?.groupUid).toBe('dst');
    expect(moved?.layout).toBeUndefined();
    unmount();
  });
});
