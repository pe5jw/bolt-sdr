// SPDX-License-Identifier: GPL-2.0-or-later

/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';

import { act, render } from './meters/__tests__/harness';
import { WaterfallSurface } from './WaterfallSurface';
import { useConnectionStore } from '../state/connection-store';

vi.mock('./Waterfall', () => ({
  Waterfall: () => createElement('div', { 'data-testid': 'webgl-waterfall' }),
}));

vi.mock('./WaterfallHeightfield', () => ({
  WaterfallHeightfield: () => createElement('div', { 'data-testid': 'webgpu-waterfall' }),
}));

describe('WaterfallSurface', () => {
  afterEach(() => {
    useConnectionStore.setState({ connectedProtocol: null });
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('uses the WebGPU heightfield by default outside P3', () => {
    act(() => {
      useConnectionStore.setState({ connectedProtocol: 'P2' });
    });

    const { container, unmount } = render(createElement(WaterfallSurface));

    expect(container.querySelector('[data-testid="webgpu-waterfall"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="webgl-waterfall"]')).toBeNull();
    unmount();
  });

  it('forces P3 sessions onto the hardened WebGL waterfall', () => {
    act(() => {
      useConnectionStore.setState({ connectedProtocol: 'P3' });
    });

    const { container, unmount } = render(createElement(WaterfallSurface));

    expect(container.querySelector('[data-testid="webgl-waterfall"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="webgpu-waterfall"]')).toBeNull();
    unmount();
  });
});
