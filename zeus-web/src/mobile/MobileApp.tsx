// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// Mobile single-column shell. Renders the same widgets and stores the
// desktop layout uses, in a vertical stack tuned for a touch viewport.
// The layout shape comes from the Zeus Mobile design hand-off; colours,
// type, and controls are the existing Zeus surface (tokens.css + the
// component library) per the maintainer's brief.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { setMode, type RxMode } from '../api/client';
import { useConnectionStore } from '../state/connection-store';
import { useQrzStore } from '../state/qrz-store';
import { useTxStore } from '../state/tx-store';
import { useDisplaySettingsStore } from '../state/display-settings-store';
import { VfoDisplay } from '../components/VfoDisplay';
import { SMeterLive } from '../components/SMeterLive';
import { Panadapter } from '../components/Panadapter';
import { Waterfall } from '../components/Waterfall';
import { MobilePttButton } from '../components/MobilePttButton';
import { TunButton } from '../components/TunButton';
import { PsToggleButton } from '../components/PsToggleButton';
import { AudioToggle } from '../components/AudioToggle';
import { BandButtons } from '../components/BandButtons';
import { TuningStepWidget } from '../components/TuningStepWidget';
import { AgcSlider } from '../components/AgcSlider';
import { DriveSlider } from '../components/DriveSlider';
import { MicGainSlider } from '../components/MicGainSlider';
import { TunePowerSlider } from '../components/TunePowerSlider';
import { useVfoLockStore } from '../state/vfo-lock-store';
import { ConnectPanel } from '../components/ConnectPanel';
import { LeafletWorldMap } from '../components/design/LeafletWorldMap';
import { LeafletMapErrorBoundary } from '../components/design/LeafletMapErrorBoundary';
import { bandOf } from '../components/design/data';
import './mobile.css';

const MODES: readonly RxMode[] = ['LSB', 'USB', 'CWL', 'CWU', 'AM', 'FM', 'DIGU'];

const MOBILE_QUERY = '(max-width: 900px)';

// Reactive viewport check. `?mobile=1` forces the mobile shell on for desktop
// previews; everything else honours the matchMedia breakpoint and updates
// when the window is resized or the device rotates.
export function useIsMobileViewport(): boolean {
  const [mobile, setMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('mobile') === '1') return true;
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('mobile') === '1') return; // forced — no listener needed
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return mobile;
}

type MobileTab = 'radio' | 'settings';

export function MobileApp() {
  const status = useConnectionStore((s) => s.status);
  const endpoint = useConnectionStore((s) => s.endpoint);
  const lastEndpoint = useConnectionStore((s) => s.lastConnectedEndpoint);
  const vfoHz = useConnectionStore((s) => s.vfoHz);
  const mode = useConnectionStore((s) => s.mode);
  const qrzHome = useQrzStore((s) => s.home);
  const qrzHasXml = useQrzStore((s) => s.hasXmlSubscription);
  const connected = status === 'Connected';

  const radioLabel = endpoint || lastEndpoint || '—';
  const bandLabel = bandOf(vfoHz);
  const freqMHz = (vfoHz / 1_000_000).toFixed(3);

  const [activeTab, setActiveTab] = useState<MobileTab>('radio');

  // Radio selector overlay. Open from the topbar; auto-close once a connect
  // *transition* completes (status flips Disconnected → Connected) so the
  // operator lands back on the radio screen without an extra dismiss tap.
  // Watching the edge — not the steady state — lets the operator open the
  // selector while already connected (to disconnect or switch radios)
  // without it slamming shut on first render.
  const [selectorOpen, setSelectorOpen] = useState(false);
  const prevConnectedRef = useRef(connected);
  useEffect(() => {
    if (selectorOpen && !prevConnectedRef.current && connected) {
      setSelectorOpen(false);
    }
    prevConnectedRef.current = connected;
  }, [selectorOpen, connected]);

  // QRZ map background — mirrors desktop's behaviour. The map renders behind
  // the spectrum stack when the operator has a QTH home pinned and an XML
  // subscription (same gate as App.tsx's qrzActive). LeafletWorldMap takes a
  // MapStation shape (call, not callsign), so we adapt the QrzStation here
  // the same way App.tsx:446-454 does.
  const effectiveHome =
    qrzHome && qrzHome.lat != null && qrzHome.lon != null && qrzHasXml
      ? {
          call: qrzHome.callsign,
          lat: qrzHome.lat,
          lon: qrzHome.lon,
          grid: qrzHome.grid ?? '',
          imageUrl: qrzHome.imageUrl ?? null,
        }
      : null;

  // Panadapter background mode — same store the desktop reads from, so a
  // setting picked on desktop (basic / beam-map / image) follows the operator
  // to mobile via localStorage. Mobile has no Display settings entry point of
  // its own yet; this is inheritance-only by design.
  const panBackground = useDisplaySettingsStore((s) => s.panBackground);
  const backgroundImage = useDisplaySettingsStore((s) => s.backgroundImage);
  const backgroundImageFit = useDisplaySettingsStore((s) => s.backgroundImageFit);
  const terminatorActive = panBackground === 'beam-map';
  const imageMode = panBackground === 'image' && !!backgroundImage;

  return (
    <div className="m-app">
      <header className="m-topbar">
        <div className="m-brand">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <circle cx="12" cy="12" r="3" fill="var(--accent)" />
            <circle cx="12" cy="12" r="7" fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.5" />
            <circle cx="12" cy="12" r="11" fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.25" />
          </svg>
          <span className="m-brand-text">
            <span className="m-brand-pre">OpenHpsdr</span>
            <span className="m-brand-name">Zeus</span>
          </span>
        </div>
        <nav className="m-tabs" role="tablist" aria-label="Mobile sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'radio'}
            className={`m-tab ${activeTab === 'radio' ? 'on' : ''}`}
            onClick={() => setActiveTab('radio')}
          >
            Radio
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'settings'}
            className={`m-tab ${activeTab === 'settings' ? 'on' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </nav>
        <button
          type="button"
          className="m-conn-btn"
          data-connected={connected}
          onClick={() => setSelectorOpen(true)}
          title={connected ? `Connected to ${radioLabel} — tap to manage` : 'Tap to discover radios'}
          aria-label={connected ? `Connected to ${radioLabel} — tap to manage` : 'Tap to discover radios'}
        >
          <span
            className={`m-conn-led${connected ? '' : ' m-conn-led--off'}`}
            aria-hidden
          />
          <span className={`m-conn-action${connected ? '' : ' m-conn-action--primary'}`}>
            {connected ? 'Disconnect' : 'Connect'}
          </span>
        </button>
      </header>

      {selectorOpen && (
        <div
          className="m-selector-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Radio selector"
          onClick={(e) => {
            // Backdrop click dismisses; clicks inside the sheet bubble through
            // to here too, so guard on currentTarget.
            if (e.target === e.currentTarget) setSelectorOpen(false);
          }}
        >
          <div className="m-selector-sheet">
            <header className="m-selector-head">
              <span className="m-selector-title">Radio</span>
              <button
                type="button"
                className="m-selector-close"
                onClick={() => setSelectorOpen(false)}
                aria-label="Close radio selector"
              >
                ✕
              </button>
            </header>
            <div className="m-selector-body">
              <ConnectPanel />
            </div>
          </div>
        </div>
      )}

      <main className="m-stack">
        {activeTab === 'radio' ? (
          <>
            <Section label="Frequency" meta="VFO A">
              <div className="m-vfo-grid">
                <div className="m-vfo-wrap">
                  <VfoDisplay />
                </div>
                <div className="m-vfo-side">
                  <div className="m-vfo-side-cell"><AudioToggle /></div>
                  <div className="m-vfo-side-cell"><VfoLockButton /></div>
                </div>
              </div>
            </Section>

            <SMeterSection />


            <Section label="Panadapter" meta={`${freqMHz} MHz · ${bandLabel}`}>
              <div className={`m-pan-stack${imageMode ? ' image-mode' : ''}`}>
                {imageMode && (
                  <div
                    className={`image-layer ${backgroundImageFit}`}
                    style={{ backgroundImage: `url(${backgroundImage})` }}
                  />
                )}
                {terminatorActive && effectiveHome && (
                  // The "map-layer visible" pair pulls in the desktop sizing
                  // chain in layout.css:451-470 — without it the inner Leaflet
                  // .leaflet-container collapses to 0×0 and tiles never paint.
                  // .m-map-layer still applies for any mobile-only tweaks.
                  <div className="m-map-layer map-layer visible">
                    <LeafletMapErrorBoundary fallback={null} onError={() => undefined}>
                      <LeafletWorldMap
                        home={effectiveHome}
                        target={null}
                        active
                        interactive={false}
                      />
                    </LeafletMapErrorBoundary>
                  </div>
                )}
                <div className="m-pan-spectrum">
                  <div className="m-pan">
                    <Panadapter />
                  </div>
                  <div className="m-wf">
                    {/* Opaque under beam-map: dark Esri tiles + near-black
                        noise floor blended and the waterfall read as solid
                        black. Transparent under imageMode so the user's
                        picture shows through both halves (matches desktop). */}
                    <Waterfall transparent={imageMode} />
                  </div>
                </div>
              </div>
            </Section>

            <div className="m-mox-block">
              <MicGate />
              <div className="m-ptt-row">
                <MobilePttButton />
                <div className="m-ptt-tun"><TunButton /></div>
              </div>
            </div>

            <Section label="Mode · Band">
              <div className="m-controls">
                <div className="m-control-row m-control-row--2">
                  <label className="m-control">
                    <span className="m-control-lbl">Mode</span>
                    <select
                      className="m-select"
                      value={mode}
                      disabled={!connected}
                      onChange={(e) => setMode(e.target.value as RxMode).catch(() => undefined)}
                    >
                      {MODES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <label className="m-control">
                    <span className="m-control-lbl">Band</span>
                    <BandButtons />
                  </label>
                </div>
              </div>
            </Section>
          </>
        ) : (
          <Section label="Controls">
            <div className="m-controls">
              <div className="m-control-row m-control-row--1">
                <label className="m-control">
                  <span className="m-control-lbl">Step</span>
                  <TuningStepWidget />
                </label>
              </div>
              <div className="m-slider-row"><AgcSlider /></div>
              <div className="m-slider-row m-slider-row--lbl"><DriveSlider /></div>
              <div className="m-slider-row m-slider-row--lbl"><TunePowerSlider /></div>
              <div className="m-slider-row m-slider-row--lbl"><MicGainSlider /></div>
              <div className="m-ps-row"><PsToggleButton /></div>
            </div>
          </Section>
        )}
      </main>
    </div>
  );
}

// Mic permission gate. useMicUplink() in App.tsx kicks getUserMedia at mount
// — that call falls outside any user gesture, and on iOS Safari over plain
// HTTP-on-LAN-IP the origin isn't a secure context either, so the call is
// silently rejected. Surfaces the error and offers an "Allow microphone"
// button that re-requests permission FROM the user gesture, where Safari
// will actually present the prompt. Reloads on success so the existing
// uplink hook picks up the granted permission cleanly.
function MicGate() {
  const micError = useTxStore((s) => s.micError);
  const [granting, setGranting] = useState(false);

  if (!micError) return null;

  // Non-secure-context detection. Localhost is treated as secure even over
  // HTTP, but a LAN IP like 192.168.x.y over plain HTTP fails this and is
  // unrecoverable without an HTTPS scheme.
  const insecure =
    typeof window !== 'undefined' && window.isSecureContext === false;

  const onAllow = async () => {
    setGranting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Tear the temp stream down — useMicUplink will open its own once we
      // reload. Holding it would tie up the mic.
      for (const t of stream.getTracks()) t.stop();
      useTxStore.getState().setMicError(null);
      // Reload so useMicUplink's mount-effect re-runs with permission
      // already granted; in-place retry would need plumbing the hook to
      // accept a reset token.
      window.location.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      useTxStore.getState().setMicError(msg);
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="m-mic-gate" role="alert">
      <div className="m-mic-gate__msg">
        <strong>Microphone unavailable.</strong>{' '}
        {insecure
          ? 'Mobile browsers require HTTPS for microphone access. The Zeus server prints an https:// LAN URL at startup — open that one on your phone instead. The first visit will warn that the certificate is self-signed; tap through to proceed.'
          : micError}
      </div>
      {!insecure && (
        <button
          type="button"
          className="m-mic-gate__btn"
          onClick={onAllow}
          disabled={granting}
        >
          {granting ? 'Requesting…' : 'Allow microphone'}
        </button>
      )}
    </div>
  );
}

// S-Meter card. Wrapped in its own component so subscribing to TX state
// for the in-header SWR + MIC chips doesn't re-render the whole MobileApp
// at the meter's update rate. During TX, the chips render in the section
// header (right-aligned) instead of below the meter — keeping the body
// height fixed so keying MOX doesn't push the PTT button down.
function SMeterSection() {
  const moxOn = useTxStore((s) => s.moxOn);
  const tunOn = useTxStore((s) => s.tunOn);
  const swr = useTxStore((s) => s.swr);
  const micDbfs = useTxStore((s) => s.micDbfs);
  const transmitting = moxOn || tunOn;
  const swrColor = swr >= 3 ? 'var(--tx)' : swr >= 2 ? 'var(--power)' : 'var(--fg-0)';

  const chips = transmitting ? (
    <>
      <span className="chip mono">
        <span className="k">SWR</span>
        <span className="v" style={{ color: swrColor }}>{swr.toFixed(2)}</span>
      </span>
      <span className="chip mono">
        <span className="k">MIC</span>
        <span className="v">{micDbfs.toFixed(0)} dBfs</span>
      </span>
    </>
  ) : null;

  return (
    <Section label="S-Meter" meta={transmitting ? 'TX' : 'RX'} extra={chips} tight>
      <SMeterLive hideChips />
    </Section>
  );
}

// Padlock toggle that pins the VFO. The lock state lives in vfo-lock-store
// and is consulted by `api/client.setVfo` so finger-drags on the panadapter,
// band-button taps, scrolls, and digit edits all no-op while engaged. Glyphs
// are inline SVG so the button looks the same across iOS / Android / desktop
// without depending on emoji font availability.
function VfoLockButton() {
  const locked = useVfoLockStore((s) => s.locked);
  const toggle = useVfoLockStore((s) => s.toggle);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={locked}
      aria-label={locked ? 'VFO locked — tap to unlock' : 'VFO unlocked — tap to lock'}
      title={locked ? 'VFO locked — tap to unlock' : 'Lock VFO'}
      className={`btn m-lock-btn ${locked ? 'on' : ''}`}
    >
      {locked ? (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <rect x="5" y="11" width="14" height="9" rx="1.5" fill="currentColor" />
          <path
            d="M8 11V8a4 4 0 0 1 8 0v3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <rect x="5" y="11" width="14" height="9" rx="1.5" fill="currentColor" />
          <path
            d="M8 11V8a4 4 0 0 1 7.5-2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
      <span className="m-lock-lbl">{locked ? 'LOCKED' : 'LOCK'}</span>
    </button>
  );
}

function Section({
  label,
  meta,
  extra,
  tight,
  children,
}: {
  label: string;
  meta?: string;
  /** Right-aligned slot in the section header. Used by the S-Meter card to
   *  surface SWR + MIC dBfs chips during TX without growing the body and
   *  shifting the PTT button below it. */
  extra?: ReactNode;
  /** Strip the body padding — used by the SMeter section so the meter
   *  fills the chrome edge to edge. */
  tight?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`m-section${tight ? ' m-section--tight' : ''}`}>
      <header className="m-section-head">
        <span className="m-section-led" />
        <span className="m-section-label">{label}</span>
        {meta && <span className="m-section-meta">· {meta}</span>}
        {extra && <span className="m-section-extra">{extra}</span>}
      </header>
      <div className="m-section-body">{children}</div>
    </section>
  );
}

