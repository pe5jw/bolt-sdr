// SPDX-License-Identifier: GPL-2.0-or-later

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __resetAudioHostModeForTests,
  getAudioHostMode,
  isNativeAudio,
  setAudioHostMode,
} from './host-mode';

describe('audio host-mode flag', () => {
  afterEach(() => {
    __resetAudioHostModeForTests();
    vi.restoreAllMocks();
  });

  it('defaults to browser mode so today\'s behaviour is the worst case', () => {
    expect(getAudioHostMode()).toBe('browser');
    expect(isNativeAudio()).toBe(false);
  });

  it('flips to native and logs exactly once across repeated calls', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    setAudioHostMode('native');
    setAudioHostMode('native');
    setAudioHostMode('native');
    expect(isNativeAudio()).toBe(true);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]?.[0]).toMatch(/native audio active/);
  });

  it('round-trips back to browser cleanly', () => {
    setAudioHostMode('native');
    expect(isNativeAudio()).toBe(true);
    setAudioHostMode('browser');
    expect(isNativeAudio()).toBe(false);
    expect(getAudioHostMode()).toBe('browser');
  });
});
