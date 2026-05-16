// SPDX-License-Identifier: GPL-2.0-or-later
//
// Audio host-mode flag. Single source of truth for "is the server playing
// RX audio natively?" in non-React code paths (audio-client, ws-client).
//
// React components subscribe directly to capabilities-store; this module
// mirrors the same `host` field so consumers that can't `useSyncExternal-
// Store` (the audio-client singleton, the WebSocket message dispatcher)
// can still cheaply check the mode on the hot path.
//
// Wired by App.tsx after /api/capabilities resolves; defaults to
// `'browser'` so the worst-case is "today's behaviour" — never accidentally
// silent — while the fetch is in flight.

export type AudioHostMode = 'browser' | 'native';

let mode: AudioHostMode = 'browser';
let nativeLogged = false;

/**
 * Set the active audio host mode. Idempotent; logs once when the mode
 * transitions to `'native'` so the operator sees a single
 * "native audio active (desktop mode)" line in the devtools console
 * confirming the opt-out fired.
 */
export function setAudioHostMode(next: AudioHostMode): void {
  if (mode === next) return;
  mode = next;
  if (next === 'native' && !nativeLogged) {
    nativeLogged = true;
    console.log('audio.host: native audio active (desktop mode)');
  }
}

export function getAudioHostMode(): AudioHostMode {
  return mode;
}

/** True when the desktop host is rendering RX audio via its native sink. */
export function isNativeAudio(): boolean {
  return mode === 'native';
}

// Test-only escape hatch. Resets both the mode and the log latch so a
// `describe` block can drive transitions without polluting later tests.
export function __resetAudioHostModeForTests(): void {
  mode = 'browser';
  nativeLogged = false;
}
