// SPDX-License-Identifier: GPL-2.0-or-later

/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';

import { render } from './meters/__tests__/harness';
import { PanadapterSurface } from './PanadapterSurface';

vi.mock('./Panadapter', () => ({
  Panadapter: () => createElement('div', { 'data-testid': 'webgl-panadapter' }),
}));

vi.mock('./Panadapter3D', () => ({
  Panadapter3D: () => createElement('div', { 'data-testid': 'webgpu-panadapter-3d' }),
}));

describe('PanadapterSurface', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('uses the WebGPU 3D panadapter by default', () => {
    const { container, unmount } = render(createElement(PanadapterSurface));

    expect(container.querySelector('[data-testid="webgpu-panadapter-3d"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="webgl-panadapter"]')).toBeNull();
    unmount();
  });

  it('uses the WebGL panadapter when the WebGPU panadapter is disabled', () => {
    localStorage.setItem('zeus.panadapter.webgpu3d', '0');

    const { container, unmount } = render(createElement(PanadapterSurface));

    expect(container.querySelector('[data-testid="webgl-panadapter"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="webgpu-panadapter-3d"]')).toBeNull();
    unmount();
  });
});
