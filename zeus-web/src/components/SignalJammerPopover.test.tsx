/** @vitest-environment jsdom */

import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useEasterEggStore } from '../state/easter-egg-store';
import { useSignalJammerStore } from '../state/signal-jammer-store';
import { act, render } from './meters/__tests__/harness';
import { SignalJammerPopover } from './SignalJammerPopover';

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('SignalJammerPopover', () => {
  beforeEach(() => {
    useEasterEggStore.setState({
      hardwareUnlocked: true,
      signalJammerPopoverOpen: true,
      boltClicks: 0,
    });
    useSignalJammerStore.getState().__resetForTests();
  });

  it('enables the hidden QRM control from the popout', () => {
    const { container, unmount } = render(createElement(SignalJammerPopover));
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');

    act(() => {
      checkbox?.click();
    });

    expect(checkbox).toBeTruthy();
    expect(useSignalJammerStore.getState().enabled).toBe(true);

    unmount();
  });

  it('updates the jammer level from the slider', () => {
    const { container, unmount } = render(createElement(SignalJammerPopover));
    const slider = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="range"]'))
      .find((input) => input.min === '0' && input.max === '100');

    act(() => {
      if (!slider) return;
      setInputValue(slider, '64');
    });

    expect(slider).toBeTruthy();
    expect(useSignalJammerStore.getState().level).toBe(64);

    unmount();
  });

  it('updates the typed spectrogram text', () => {
    const { container, unmount } = render(createElement(SignalJammerPopover));
    const input = container.querySelector<HTMLInputElement>('input[type="text"]');

    act(() => {
      if (!input) return;
      setInputValue(input, 'N9WAR');
    });

    expect(input).toBeTruthy();
    expect(useSignalJammerStore.getState().textSoundText).toBe('N9WAR');

    unmount();
  });
});
