// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus - OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.

import {
  normalizeSignalJammerConfig,
  type SignalJammerConfig,
} from '../state/signal-jammer-store';

// Browser-local QRM test source. This intentionally uses its own AudioContext
// and does not touch AudioClient/audio-bus, so the protected RX/TX audio
// scheduling path remains isolated from this easter-egg test tool.

type SinkSelectableAudioContext = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

type JammerGraph = {
  master: GainNode;
  nodes: AudioNode[];
  sources: AudioScheduledSourceNode[];
};

let ctx: AudioContext | null = null;
let graph: JammerGraph | null = null;
let appliedSinkId: string | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext);
  if (!Ctor) return null;
  try {
    ctx = new Ctor({ sampleRate: 48000, latencyHint: 'interactive' });
  } catch {
    ctx = null;
  }
  return ctx;
}

function setOutputDeviceIfAvailable(audio: AudioContext, outputDeviceId: string): void {
  const selectable = audio as SinkSelectableAudioContext;
  if (typeof selectable.setSinkId !== 'function') return;
  const sinkId = outputDeviceId.trim();
  if (sinkId === appliedSinkId) return;
  appliedSinkId = sinkId;
  selectable.setSinkId(sinkId).catch((err) => {
    appliedSinkId = null;
    console.warn('signal-jammer.output.setSinkId failed; using browser default output', err);
  });
}

function stopSource(source: AudioScheduledSourceNode): void {
  try {
    source.stop();
  } catch {
    // already stopped or never started
  }
}

function disconnectNode(node: AudioNode): void {
  try {
    node.disconnect();
  } catch {
    // already disconnected
  }
}

export function stopSignalJammer(): void {
  if (!graph) return;
  for (const source of graph.sources) stopSource(source);
  for (const node of graph.nodes) disconnectNode(node);
  disconnectNode(graph.master);
  graph = null;
}

export function startOrUpdateSignalJammer(
  config: Partial<SignalJammerConfig>,
  outputDeviceId = '',
): boolean {
  const audio = getCtx();
  if (!audio) return false;
  if (audio.state === 'suspended') {
    audio.resume().catch(() => {});
  }

  setOutputDeviceIfAvailable(audio, outputDeviceId);
  stopSignalJammer();

  const cfg = normalizeSignalJammerConfig(config);
  const master = audio.createGain();
  master.gain.value = levelToGain(cfg.level);
  master.connect(audio.destination);
  graph = { master, nodes: [master], sources: [] };

  switch (cfg.preset) {
    case 'heterodyne':
      addNoise(audio, master, 0.14, 1450, 0.75);
      addTone(audio, master, cfg.toneHz, 0.85, 'sine', cfg.driftHz);
      addTone(audio, master, cfg.toneHz + 43, 0.32, 'sine', Math.round(cfg.driftHz * 0.45));
      break;
    case 'pulse':
      addPulseHash(audio, master, cfg);
      break;
    case 'hash':
    default:
      addNoise(audio, master, 0.9, 1150, 0.55);
      addTone(audio, master, cfg.toneHz, 0.16, 'sine', cfg.driftHz);
      addTone(audio, master, Math.round(cfg.toneHz * 1.41), 0.1, 'triangle', Math.round(cfg.driftHz * 0.35));
      break;
  }

  return true;
}

function levelToGain(level: number): number {
  const normalized = Math.max(0, Math.min(1, level / 100));
  return Math.pow(normalized, 1.35) * 0.24;
}

function trackNode<T extends AudioNode>(node: T): T {
  graph?.nodes.push(node);
  return node;
}

function trackSource<T extends AudioScheduledSourceNode>(source: T): T {
  graph?.sources.push(source);
  graph?.nodes.push(source);
  return source;
}

function addNoise(
  audio: AudioContext,
  destination: AudioNode,
  amount: number,
  centerHz: number,
  q: number,
): void {
  const frameCount = Math.max(1, Math.floor(audio.sampleRate * 1.75));
  const buffer = audio.createBuffer(1, frameCount, audio.sampleRate);
  const samples = buffer.getChannelData(0);
  let previous = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const white = Math.random() * 2 - 1;
    previous = white * 0.72 + previous * 0.28;
    samples[i] = previous;
  }

  const source = trackSource(audio.createBufferSource());
  const filter = trackNode(audio.createBiquadFilter());
  const gain = trackNode(audio.createGain());
  source.buffer = buffer;
  source.loop = true;
  filter.type = 'bandpass';
  filter.frequency.value = centerHz;
  filter.Q.value = q;
  gain.gain.value = amount;
  source.connect(filter).connect(gain).connect(destination);
  source.start();
}

function addTone(
  audio: AudioContext,
  destination: AudioNode,
  frequencyHz: number,
  amount: number,
  type: OscillatorType,
  driftHz: number,
): void {
  const osc = trackSource(audio.createOscillator());
  const gain = trackNode(audio.createGain());
  osc.type = type;
  osc.frequency.value = Math.max(80, frequencyHz);
  gain.gain.value = amount;

  if (driftHz > 0) {
    const lfo = trackSource(audio.createOscillator());
    const lfoGain = trackNode(audio.createGain());
    lfo.type = 'sine';
    lfo.frequency.value = 0.18;
    lfoGain.gain.value = driftHz;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start();
  }

  osc.connect(gain).connect(destination);
  osc.start();
}

function addPulseHash(audio: AudioContext, destination: AudioNode, cfg: SignalJammerConfig): void {
  const gate = trackNode(audio.createGain());
  gate.gain.value = 0.5;
  gate.connect(destination);

  const lfo = trackSource(audio.createOscillator());
  const lfoDepth = trackNode(audio.createGain());
  lfo.type = 'square';
  lfo.frequency.value = cfg.pulseRateHz;
  lfoDepth.gain.value = 0.38;
  lfo.connect(lfoDepth).connect(gate.gain);
  lfo.start();

  addNoise(audio, gate, 0.85, 1850, 1.15);
  addTone(audio, gate, cfg.toneHz, 0.28, 'square', cfg.driftHz);
}
