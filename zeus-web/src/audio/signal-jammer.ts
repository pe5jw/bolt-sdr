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
      addCarrierRake(audio, master, cfg);
      break;
    case 'pulse':
      addBurstJammer(audio, master, cfg);
      break;
    case 'hash':
    default:
      addBarrageJammer(audio, master, cfg);
      break;
  }

  return true;
}

function levelToGain(level: number): number {
  const normalized = Math.max(0, Math.min(1, level / 100));
  return Math.pow(normalized, 1.35) * 0.32;
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

function addBarrageJammer(audio: AudioContext, destination: AudioNode, cfg: SignalJammerConfig): void {
  addNoise(audio, destination, 0.72, 520, 0.45);
  addNoise(audio, destination, 0.86, 1450, 0.52);
  addNoise(audio, destination, 0.58, 2550, 0.72);
  addSweptTone(audio, destination, 340, 3020, 0.31, 0.18, 'triangle');
  addComb(
    audio,
    destination,
    [300, 530, 760, 990, 1220, 1450, 1680, 1910, 2140, 2370, 2600],
    0.068,
    cfg.driftHz,
  );
  addTone(audio, destination, Math.round(cfg.toneHz * 1.73), 0.08, 'sawtooth', Math.round(cfg.driftHz * 0.4));
}

function addCarrierRake(audio: AudioContext, destination: AudioNode, cfg: SignalJammerConfig): void {
  addNoise(audio, destination, 0.18, 1500, 0.85);
  addComb(
    audio,
    destination,
    [-584, -273, -182, -91, 0, 91, 182, 273, 584]
      .map((offset) => Math.max(250, Math.min(3200, cfg.toneHz + offset))),
    0.12,
    cfg.driftHz,
  );
  addTone(audio, destination, cfg.toneHz + 43, 0.18, 'square', Math.round(cfg.driftHz * 0.35));
  addSweptTone(audio, destination, 520, 2900, 0.17, 0.13, 'sine');
}

function addBurstJammer(audio: AudioContext, destination: AudioNode, cfg: SignalJammerConfig): void {
  const gate = addSquareGate(audio, destination, cfg.pulseRateHz, 0.48, 0.46);
  addNoise(audio, gate, 0.95, 850, 0.62);
  addNoise(audio, gate, 0.74, 2200, 0.86);
  addTone(audio, gate, cfg.toneHz, 0.28, 'square', cfg.driftHz);
  addSweptTone(audio, gate, 360, 3180, 0.78, 0.18, 'sawtooth');
  addComb(audio, gate, [420, 760, 1100, 1440, 1780, 2120, 2460, 2800], 0.052, Math.round(cfg.driftHz * 0.35));
}

function addComb(
  audio: AudioContext,
  destination: AudioNode,
  frequenciesHz: readonly number[],
  amount: number,
  driftHz: number,
): void {
  const gain = amount / Math.sqrt(Math.max(1, frequenciesHz.length));
  frequenciesHz.forEach((frequencyHz, index) => {
    addTone(
      audio,
      destination,
      Math.round(Math.max(250, Math.min(3200, frequencyHz))),
      gain,
      index % 4 === 0 ? 'triangle' : 'sine',
      Math.round(driftHz * (0.18 + index * 0.025)),
    );
  });
}

function addSweptTone(
  audio: AudioContext,
  destination: AudioNode,
  lowHz: number,
  highHz: number,
  rateHz: number,
  amount: number,
  type: OscillatorType,
): void {
  const osc = trackSource(audio.createOscillator());
  const lfo = trackSource(audio.createOscillator());
  const lfoGain = trackNode(audio.createGain());
  const gain = trackNode(audio.createGain());
  osc.type = type;
  osc.frequency.value = (lowHz + highHz) / 2;
  lfo.type = 'sine';
  lfo.frequency.value = rateHz;
  lfoGain.gain.value = Math.max(0, (highHz - lowHz) / 2);
  gain.gain.value = amount;
  lfo.connect(lfoGain).connect(osc.frequency);
  osc.connect(gain).connect(destination);
  lfo.start();
  osc.start();
}

function addSquareGate(
  audio: AudioContext,
  destination: AudioNode,
  rateHz: number,
  baseGain: number,
  depth: number,
): GainNode {
  const gate = trackNode(audio.createGain());
  gate.gain.value = baseGain;
  gate.connect(destination);

  const lfo = trackSource(audio.createOscillator());
  const lfoDepth = trackNode(audio.createGain());
  lfo.type = 'square';
  lfo.frequency.value = rateHz;
  lfoDepth.gain.value = depth;
  lfo.connect(lfoDepth).connect(gate.gain);
  lfo.start();
  return gate;
}
