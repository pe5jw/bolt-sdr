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

using System.Security.Cryptography;
using Zeus.Dsp;
using Zeus.Dsp.Wdsp;
using Xunit;

namespace Zeus.Dsp.Tests;

// VST plugin-host seam — Phase 1 invariant: when the chain is bypassed
// (the only Phase 1 state), the output must be byte-identical to the
// seam-absent flow. The seam adds one virtual call and one volatile-bool
// read; nothing in the audio buffer changes.
//
// Test strategy
// -------------
// We exercise the seam at the IDspEngine surface directly — generate a
// deterministic input buffer, hash it (SHA-256), invoke ProcessRxVstChain /
// ProcessTxVstChain, hash the buffer again, and assert the digests match.
// A non-bypassed implementation would mutate `audio` in place and the
// hashes would diverge.
//
// We test against BOTH engines:
//
//   * SyntheticDspEngine — always returns false (no chain ever wired). This
//     is the bit-identity invariant for the engine that runs in CI without
//     native libs.
//
//   * WdspDspEngine — the production engine. Native libwdsp is NOT required
//     for these tests because the seam methods short-circuit on the
//     `_vstChainEnabled` volatile read before touching anything WDSP-y.
//     We use the internal SetVstChainEnabled helper (exposed via
//     InternalsVisibleTo) to confirm both states:
//       - disabled  → returns false, buffer untouched (the Phase 1 default)
//       - enabled   → still returns false in Phase 1 (TODO Phase 2:
//         dispatch to PluginHostManager), buffer untouched.
//
// We deliberately do NOT exercise WdspDspEngine.ProcessTxBlock here — that
// path requires libwdsp + an open TXA channel, which only the
// WdspDspEngineTests collection's SkippableFact pattern can provide. The
// bit-identity invariant we prove is specifically for the seam method
// itself: when the chain is disabled, the seam is a no-op.
public class VstSeamBypassBitIdentityTests
{
    // 1024 samples of a deterministic linear sweep — one cycle from -1 to +1.
    // Big enough that any in-place mutation in a buggy bypass would shift
    // the SHA-256 digest dramatically.
    private static float[] BuildDeterministicInput(int frames)
    {
        var buf = new float[frames];
        for (int i = 0; i < frames; i++)
        {
            // Map i in [0, frames) to [-1, +1]. No randomness — fully
            // reproducible across runs.
            buf[i] = (i * 2.0f / (frames - 1)) - 1.0f;
        }
        return buf;
    }

    private static byte[] HashFloats(ReadOnlySpan<float> samples)
    {
        // Re-interpret the float span as bytes. This is the same memory the
        // audio frame would carry on the wire; if the seam mutated even one
        // sample, the digest would change.
        var bytes = System.Runtime.InteropServices.MemoryMarshal.AsBytes(samples);
        return SHA256.HashData(bytes);
    }

    [Fact]
    public void SyntheticEngine_RxSeam_BypassIsBitIdentical()
    {
        using var engine = new SyntheticDspEngine();

        const int frames = 1024;
        const int sampleRateHz = 48_000;

        // Baseline: hash the deterministic input as it would appear if the
        // seam were never present.
        var baseline = BuildDeterministicInput(frames);
        byte[] baselineDigest = HashFloats(baseline);

        // Seam-present-but-bypassed: same input, run through the seam.
        var withSeam = BuildDeterministicInput(frames);
        bool processed = engine.ProcessRxVstChain(withSeam, frames, sampleRateHz);
        byte[] withSeamDigest = HashFloats(withSeam);

        Assert.False(processed);
        Assert.Equal(baselineDigest, withSeamDigest);
    }

    [Fact]
    public void SyntheticEngine_TxSeam_BypassIsBitIdentical()
    {
        using var engine = new SyntheticDspEngine();

        const int frames = 1024;
        const int sampleRateHz = 48_000;

        var baseline = BuildDeterministicInput(frames);
        byte[] baselineDigest = HashFloats(baseline);

        var withSeam = BuildDeterministicInput(frames);
        bool processed = engine.ProcessTxVstChain(withSeam, frames, sampleRateHz);
        byte[] withSeamDigest = HashFloats(withSeam);

        Assert.False(processed);
        Assert.Equal(baselineDigest, withSeamDigest);
    }

    // The WDSP engine cases below construct a WdspDspEngine but never call
    // OpenChannel / OpenTxChannel, so libwdsp.so isn't touched (the ctor
    // only registers the native resolver; no native symbols are bound until
    // a channel opens). The seam methods exit on the `_vstChainEnabled`
    // volatile read before reaching any P/Invoke, so this is safe to run
    // on builders without native libs. No [SkippableFact] needed — these
    // tests are about the bypass path, which is pure managed code.
    [Fact]
    public void WdspEngine_RxSeam_BypassIsBitIdentical_WhenChainDisabled()
    {
        using var engine = new WdspDspEngine();
        // Default state — _vstChainEnabled is false (Phase 1 default).
        Assert.False(engine.VstChainEnabled);

        const int frames = 1024;
        const int sampleRateHz = 48_000;

        var baseline = BuildDeterministicInput(frames);
        byte[] baselineDigest = HashFloats(baseline);

        var withSeam = BuildDeterministicInput(frames);
        bool processed = engine.ProcessRxVstChain(withSeam, frames, sampleRateHz);
        byte[] withSeamDigest = HashFloats(withSeam);

        Assert.False(processed);
        Assert.Equal(baselineDigest, withSeamDigest);
    }

    [Fact]
    public void WdspEngine_TxSeam_BypassIsBitIdentical_WhenChainDisabled()
    {
        using var engine = new WdspDspEngine();
        Assert.False(engine.VstChainEnabled);

        // P2 profile sample rate per IDspEngine.ProcessTxVstChain doc.
        const int frames = 1024;
        const int sampleRateHz = 192_000;

        var baseline = BuildDeterministicInput(frames);
        byte[] baselineDigest = HashFloats(baseline);

        var withSeam = BuildDeterministicInput(frames);
        bool processed = engine.ProcessTxVstChain(withSeam, frames, sampleRateHz);
        byte[] withSeamDigest = HashFloats(withSeam);

        Assert.False(processed);
        Assert.Equal(baselineDigest, withSeamDigest);
    }

    // Phase 2 wiring will set the flag to true; Phase 1 still returns false
    // (the host project hasn't shipped) and continues to leave the buffer
    // untouched. This nails down the contract: a "true" flag value is NOT a
    // licence for the engine to mutate the buffer until the host actually
    // wires up — TODO Phase 2 will replace these no-op returns with real
    // dispatch.
    [Fact]
    public void WdspEngine_RxSeam_StillBypassesEvenWhenFlagFlipped_InPhase1()
    {
        using var engine = new WdspDspEngine();
        engine.SetVstChainEnabled(true);
        Assert.True(engine.VstChainEnabled);

        const int frames = 1024;
        const int sampleRateHz = 48_000;

        var baseline = BuildDeterministicInput(frames);
        byte[] baselineDigest = HashFloats(baseline);

        var withSeam = BuildDeterministicInput(frames);
        bool processed = engine.ProcessRxVstChain(withSeam, frames, sampleRateHz);
        byte[] withSeamDigest = HashFloats(withSeam);

        // Phase 1: even with the flag flipped, the TODO-stubbed dispatch
        // returns false and leaves the buffer untouched.
        Assert.False(processed);
        Assert.Equal(baselineDigest, withSeamDigest);
    }

    [Fact]
    public void WdspEngine_TxSeam_StillBypassesEvenWhenFlagFlipped_InPhase1()
    {
        using var engine = new WdspDspEngine();
        engine.SetVstChainEnabled(true);

        const int frames = 1024;
        const int sampleRateHz = 192_000;

        var baseline = BuildDeterministicInput(frames);
        byte[] baselineDigest = HashFloats(baseline);

        var withSeam = BuildDeterministicInput(frames);
        bool processed = engine.ProcessTxVstChain(withSeam, frames, sampleRateHz);
        byte[] withSeamDigest = HashFloats(withSeam);

        Assert.False(processed);
        Assert.Equal(baselineDigest, withSeamDigest);
    }
}
