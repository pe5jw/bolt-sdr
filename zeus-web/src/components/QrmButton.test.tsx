/** @vitest-environment jsdom */

import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSignalJammerStore } from '../state/signal-jammer-store';
import { useEasterEggStore } from '../state/easter-egg-store';
import { act, render } from './meters/__tests__/harness';
import { QrmButton, QrmPanelToggleButton } from './QrmButton';

describe('QrmButton', () => {
  beforeEach(() => {
    useSignalJammerStore.getState().__resetForTests();
    useEasterEggStore.setState({
      hardwareUnlocked: true,
      signalJammerPopoverOpen: false,
      boltClicks: 0,
    });
  });

  it('stays hidden until the hidden jammer is enabled', () => {
    const { container, unmount } = render(createElement(QrmButton));

    expect(container.querySelector('button')).toBeNull();

    unmount();
  });

  it('toggles active QRM when enabled', () => {
    useSignalJammerStore.getState().setEnabled(true);
    const { container, unmount } = render(createElement(QrmButton));
    const button = container.querySelector<HTMLButtonElement>('button');

    act(() => {
      button?.click();
    });

    expect(button).toBeTruthy();
    expect(useSignalJammerStore.getState().active).toBe(true);
    expect(button?.getAttribute('aria-pressed')).toBe('true');

    unmount();
  });

  it('toggles the QRM panel from the top bar after the jammer is enabled', () => {
    useSignalJammerStore.getState().setEnabled(true);
    const { container, unmount } = render(createElement(QrmPanelToggleButton));
    const button = container.querySelector<HTMLButtonElement>('button');

    act(() => {
      button?.click();
    });

    expect(button).toBeTruthy();
    expect(useEasterEggStore.getState().signalJammerPopoverOpen).toBe(true);
    expect(button?.getAttribute('aria-expanded')).toBe('true');

    unmount();
  });
});
