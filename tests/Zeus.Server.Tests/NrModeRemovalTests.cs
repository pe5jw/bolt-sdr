// SPDX-License-Identifier: GPL-2.0-or-later

using Microsoft.Extensions.Logging.Abstractions;
using Zeus.Contracts;
using Zeus.Server;

namespace Zeus.Server.Tests;

public sealed class NrModeRemovalTests : IDisposable
{
    private readonly string _basePath = Path.Combine(
        Path.GetTempPath(),
        $"zeus-nr-unsupported-{Guid.NewGuid():N}");

    public void Dispose()
    {
        foreach (var path in Directory.EnumerateFiles(Path.GetTempPath(), Path.GetFileName(_basePath) + "*"))
        {
            try { File.Delete(path); } catch { }
        }
    }

    [Fact]
    public void SetNr_NormalizesUnsupportedModeToOff()
    {
        using var dspStore = NewDspStore();
        using var radio = NewRadio(dspStore);

        var snapshot = radio.SetNr(new NrConfig(NrMode: (NrMode)4));

        Assert.Equal(NrMode.Off, snapshot.Nr?.NrMode);
        Assert.Equal(NrMode.Off, dspStore.Get()?.NrMode);
    }

    [Fact]
    public void Constructor_NormalizesPersistedUnsupportedModeToOff()
    {
        using var dspStore = NewDspStore();
        dspStore.Upsert(new NrConfig(NrMode: (NrMode)4));

        using var radio = NewRadio(dspStore);

        Assert.Equal(NrMode.Off, radio.Snapshot().Nr?.NrMode);
    }

    private RadioService NewRadio(DspSettingsStore dspStore)
    {
        var paStore = new PaSettingsStore(NullLogger<PaSettingsStore>.Instance, _basePath + ".pa");
        return new RadioService(NullLoggerFactory.Instance, dspStore, paStore);
    }

    private DspSettingsStore NewDspStore() =>
        new(NullLogger<DspSettingsStore>.Instance, _basePath + ".dsp");
}
