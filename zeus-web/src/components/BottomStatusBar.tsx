// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// BottomStatusBar — always-visible status strip at the bottom of the app
// shell. Holds the radio brand sub-label (e.g. "ANAN G2" / "NOT CONNECTED"),
// link state, and the QRZ + Rotator status pills that used to live in the
// top bar. The workspace above scrolls when there are too many flex panels;
// this bar stays pinned (issue #241).

import { useConnectionStore } from '../state/connection-store';
import { useRadioStore } from '../state/radio-store';
import { BOARD_LABELS } from '../api/radio';
import { QrzStatusPill } from './QrzStatusPill';
import { RotatorStatusPill } from './RotatorStatusPill';

export function BottomStatusBar() {
  const status = useConnectionStore((s) => s.status);
  const connected = status === 'Connected';
  const radioConnected = useRadioStore((s) => s.selection.connected);
  const brandSub = radioConnected !== 'Unknown'
    ? BOARD_LABELS[radioConnected].toUpperCase()
    : 'NOT CONNECTED';

  return (
    <footer className="bottom-status-bar" role="contentinfo">
      <div className="bsb-info">
        <span className="bsb-brand mono">OpenHpsdr Zeus</span>
        <span className="bsb-divider" aria-hidden />
        <span className="bsb-sub label-xs">{brandSub}</span>
      </div>

      <div className="bsb-spacer" />

      <div className="bsb-pills">
        <span className={`chip ${connected ? 'accent' : ''}`}>
          <span className="k">LINK</span>
          <span className="v mono">{connected ? 'UP' : 'DOWN'}</span>
        </span>
        <RotatorStatusPill />
        <QrzStatusPill />
      </div>
    </footer>
  );
}
