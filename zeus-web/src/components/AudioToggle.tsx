// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA), and contributors.
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, either version 2 of the License, or (at your
// option) any later version. See the LICENSE file at the root of this
// repository for the full text, or https://www.gnu.org/licenses/.
//
// Zeus is an independent reimplementation in .NET — not a fork. Its
// Protocol-1 / Protocol-2 framing, WDSP integration, meter pipelines, and
// TX behaviour were informed by studying the Thetis project
// (https://github.com/ramdor/Thetis), the authoritative reference
// implementation in the OpenHPSDR ecosystem. Zeus gratefully acknowledges
// the Thetis contributors whose work made this possible:
//
//   Richard Samphire (MW0LGE), Warren Pratt (NR0V),
//   Laurence Barker (G8NJJ),   Rick Koch (N1GP),
//   Bryan Rambo (W4WMT),       Chris Codella (W2PA),
//   Doug Wigley (W5WC),        FlexRadio Systems,
//   Richard Allen (W5SD),      Joe Torrey (WD5Y),
//   Andrew Mansfield (M0YGG),  Reid Campbell (MI0BOT),
//   Sigi Jetzlsperger (DH1KLM).
//
// Thetis itself continues the GPL-governed lineage of FlexRadio PowerSDR
// and the OpenHPSDR (TAPR/OpenHPSDR) ecosystem; that lineage is preserved
// here. See ATTRIBUTIONS.md at the repository root for the full provenance
// statement and per-component attribution.
//
// Protocol-2 / PureSignal / Saturn-class behaviour was additionally informed
// by pihpsdr (https://github.com/dl1ycf/pihpsdr), maintained by Christoph
// Wüllen (DL1YCF); and by DeskHPSDR
// (https://github.com/dl1bz/deskhpsdr), maintained by Heiko (DL1BZ).
// Both are GPL-2.0-or-later.
//
// WDSP — loaded by Zeus via P/Invoke — is Copyright (C) Warren Pratt
// (NR0V), distributed under GPL v2 or later.
//
// Zeus is distributed WITHOUT ANY WARRANTY; see the GNU General Public
// License for details.

import { useEffect, useState } from 'react';
import { getAudioClient, type AudioClientState } from '../audio/audio-client';
import { useCapabilitiesStore } from '../state/capabilities-store';

export function AudioToggle() {
  const [state, setState] = useState<AudioClientState>({ kind: 'idle' });
  // Phase 2c — in desktop mode the host process renders RX audio through
  // its native miniaudio sink, so the Mute/Unmute button (which gates an
  // in-browser AudioContext) is meaningless. Render a passive status
  // indicator in its place. The AF slider next door still drives the
  // server-side WDSP gain, so volume control is fully functional in both
  // modes without touching this component.
  const hostMode = useCapabilitiesStore((s) => s.capabilities?.host ?? null);
  const nativeAudio = hostMode === 'desktop';

  useEffect(() => {
    return getAudioClient().subscribe((s) => {
      setState(s);
    });
  }, []);

  if (nativeAudio) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        title="RX audio is playing through the host's default output device."
      >
        <span className="chip">
          <span className="k">AUDIO</span>
          <span className="v">native (default device)</span>
        </span>
      </div>
    );
  }

  const onClick = async () => {
    const client = getAudioClient();
    if (state.kind === 'playing' || state.kind === 'loading') {
      await client.stop();
    } else {
      await client.start();
    }
  };

  const playing = state.kind === 'playing';
  const loading = state.kind === 'loading';
  const label = loading
    ? 'Loading…'
    : playing
    ? '■ Mute'
    : '▶ Unmute';

  const title = state.kind === 'error' ? state.message : undefined;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        onPointerUp={onClick}
        disabled={loading}
        className={`btn tx-btn ${!playing && !loading ? 'active' : ''}`}
        title={title}
      >
        <span className={`led ${!playing && !loading ? 'on' : ''}`} style={{ marginRight: 6 }} />
        {label}
      </button>
      {state.kind === 'error' && (
        <span className="label-xs" style={{ color: 'var(--tx)' }}>
          audio error
        </span>
      )}
    </div>
  );
}
