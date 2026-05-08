// SPDX-License-Identifier: GPL-2.0-or-later
//
// Verifies the active-consumer registry that gates decodeDisplayFrame in
// ws-client.ts. The contract: hasActiveFrameConsumers() reports whether at
// least one panadapter / waterfall / filter mini-pan is mounted; ws-client
// short-circuits the per-frame decode when it returns false.

import { afterEach, describe, expect, it } from 'vitest';
import {
  _resetFrameConsumerCount,
  hasActiveFrameConsumers,
  registerFrameConsumer,
} from './display-store';

afterEach(() => {
  _resetFrameConsumerCount();
});

describe('frame consumer registry', () => {
  it('reports no consumers initially', () => {
    expect(hasActiveFrameConsumers()).toBe(false);
  });

  it('flips to true while a consumer is registered', () => {
    const release = registerFrameConsumer();
    expect(hasActiveFrameConsumers()).toBe(true);
    release();
    expect(hasActiveFrameConsumers()).toBe(false);
  });

  it('stays true while at least one consumer remains', () => {
    const a = registerFrameConsumer();
    const b = registerFrameConsumer();
    expect(hasActiveFrameConsumers()).toBe(true);
    a();
    expect(hasActiveFrameConsumers()).toBe(true);
    b();
    expect(hasActiveFrameConsumers()).toBe(false);
  });

  it('release is idempotent', () => {
    const release = registerFrameConsumer();
    release();
    release();
    expect(hasActiveFrameConsumers()).toBe(false);
    // A second consumer must still flip the flag back on.
    const next = registerFrameConsumer();
    expect(hasActiveFrameConsumers()).toBe(true);
    next();
  });

  it('count never goes negative under bad release ordering', () => {
    const a = registerFrameConsumer();
    a();
    a();
    expect(hasActiveFrameConsumers()).toBe(false);
    const b = registerFrameConsumer();
    expect(hasActiveFrameConsumers()).toBe(true);
    b();
    expect(hasActiveFrameConsumers()).toBe(false);
  });
});
