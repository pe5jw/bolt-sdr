// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus - OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.

import { useEffect } from 'react';
import { startOrUpdateSignalJammer, stopSignalJammer } from '../audio/signal-jammer';
import { useAudioDeviceStore } from '../state/audio-device-store';
import { useSignalJammerStore } from '../state/signal-jammer-store';

export function SignalJammerRuntime() {
  const enabled = useSignalJammerStore((s) => s.enabled);
  const active = useSignalJammerStore((s) => s.active);
  const preset = useSignalJammerStore((s) => s.preset);
  const level = useSignalJammerStore((s) => s.level);
  const toneHz = useSignalJammerStore((s) => s.toneHz);
  const driftHz = useSignalJammerStore((s) => s.driftHz);
  const pulseRateHz = useSignalJammerStore((s) => s.pulseRateHz);
  const setActive = useSignalJammerStore((s) => s.setActive);
  const setRuntimeStatus = useSignalJammerStore((s) => s.setRuntimeStatus);
  const outputDeviceId = useAudioDeviceStore((s) => s.browserOutputDeviceId);

  useEffect(() => () => stopSignalJammer(), []);

  useEffect(() => {
    if (!enabled) {
      stopSignalJammer();
      setRuntimeStatus('idle');
      return;
    }

    if (!active) {
      stopSignalJammer();
      if (useSignalJammerStore.getState().runtimeStatus === 'running') {
        setRuntimeStatus('idle');
      }
      return;
    }

    const started = startOrUpdateSignalJammer(
      { preset, level, toneHz, driftHz, pulseRateHz },
      outputDeviceId,
    );
    if (started) {
      setRuntimeStatus('running');
      return;
    }

    setActive(false);
    setRuntimeStatus('unavailable', 'Web Audio unavailable');
  }, [
    active,
    driftHz,
    enabled,
    level,
    outputDeviceId,
    preset,
    pulseRateHz,
    setActive,
    setRuntimeStatus,
    toneHz,
  ]);

  return null;
}
