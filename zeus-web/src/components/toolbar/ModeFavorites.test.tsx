/** @vitest-environment jsdom */

import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, render } from '../meters/__tests__/harness';
import { setMode, type RadioStateDto } from '../../api/client';
import { useConnectionStore } from '../../state/connection-store';
import { useToolbarFavoritesStore } from '../../state/toolbar-favorites-store';
import { ModeFavorites } from './ModeFavorites';

function currentStateDto(): RadioStateDto {
  return useConnectionStore.getState() as unknown as RadioStateDto;
}

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return {
    ...actual,
    setMode: vi.fn(async () => currentStateDto()),
  };
});

function resetStores() {
  useConnectionStore.setState({
    status: 'Connected',
    rx2Enabled: true,
    rxFocus: 'B',
    mode: 'AM',
    modeB: 'USB',
  });
  useToolbarFavoritesStore.setState({
    mode: ['USB', 'LSB', 'CWU'],
  });
}

describe('ModeFavorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it('applies topbar mode selection to focused VFO B', async () => {
    const { container, unmount } = render(createElement(ModeFavorites));
    const lsb = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === 'LSB');

    await act(async () => {
      lsb?.click();
      await Promise.resolve();
    });

    expect(lsb).toBeTruthy();
    expect(setMode).toHaveBeenCalledWith('LSB', undefined, 'B');
    expect(useConnectionStore.getState().mode).toBe('AM');
    expect(useConnectionStore.getState().modeB).toBe('LSB');

    unmount();
  });
});
