import { describe, expect, it } from 'vitest';

import {
  estimateTextSpectrogramDurationSec,
  renderTextSpectrogram,
  rowToFrequencyHz,
  synthesizeTextSpectrogramSamples,
} from './text-spectrogram';

describe('text-spectrogram', () => {
  it('renders typed letters into a non-empty spectrogram grid', () => {
    const spec = renderTextSpectrogram('HI');
    const lit = spec.pixels.reduce((sum, value) => sum + value, 0);

    expect(spec.text).toBe('HI');
    expect(spec.rows).toBe(42);
    expect(spec.columns).toBe(55);
    expect(lit).toBeGreaterThan(0);
  });

  it('upscales glyph strokes for higher-resolution waterfall text', () => {
    const spec = renderTextSpectrogram('I');

    expect(spec.rows).toBe(42);
    expect(spec.columns).toBe(25);
    expect(spec.pixels.reduce((sum, value) => sum + value, 0)).toBeGreaterThan(7 * 6);
  });

  it('maps higher rows to higher frequencies', () => {
    const top = rowToFrequencyHz(0, 7, 300, 2600);
    const bottom = rowToFrequencyHz(6, 7, 300, 2600);

    expect(top).toBeGreaterThan(bottom);
    expect(Math.round(bottom)).toBe(300);
  });

  it('synthesizes finite non-silent audio samples', () => {
    const rendered = synthesizeTextSpectrogramSamples(
      'CQ',
      { pixelsPerSecond: 20, minHz: 300, maxHz: 2600, level: 50 },
      8000,
    );
    const peak = rendered.samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);

    expect(rendered.samples.length).toBeGreaterThan(0);
    expect(Number.isFinite(peak)).toBe(true);
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(0.42);
  });

  it('uses pixels-per-second as the time scale', () => {
    const slow = estimateTextSpectrogramDurationSec('CQ', { pixelsPerSecond: 12 });
    const fast = estimateTextSpectrogramDurationSec('CQ', { pixelsPerSecond: 48 });

    expect(slow).toBeGreaterThan(fast);
  });

  it('defaults to a slower waterfall-readable writing speed', () => {
    expect(estimateTextSpectrogramDurationSec('CQ QRM')).toBeGreaterThan(10);
  });
});
