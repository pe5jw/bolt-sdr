namespace Zeus.Server.Tci;

/// <summary>
/// In-memory storage for DX cluster spots received via TCI.
/// Phase 1: stub implementation stores spots but doesn't render them on the
/// panadapter. Rendering is a follow-up issue (requires panadapter overlay).
/// </summary>
public sealed class SpotManager
{
    private readonly object _sync = new();
    private readonly Dictionary<string, Spot> _spots = new();

    /// <summary>
    /// Add or update a spot.
    /// </summary>
    public void AddSpot(string callsign, string mode, long freqHz, uint argb, string? comment = null)
    {
        lock (_sync)
        {
            _spots[callsign] = new Spot(callsign, mode, freqHz, argb, comment);
        }
    }

    /// <summary>
    /// Remove a spot by callsign.
    /// </summary>
    public void RemoveSpot(string callsign)
    {
        lock (_sync)
        {
            _spots.Remove(callsign);
        }
    }

    /// <summary>
    /// Clear all spots.
    /// </summary>
    public void ClearAll()
    {
        lock (_sync)
        {
            _spots.Clear();
        }
    }

    /// <summary>
    /// Get a snapshot of all spots.
    /// </summary>
    public Spot[] GetAll()
    {
        lock (_sync)
        {
            return _spots.Values.ToArray();
        }
    }

    public sealed record Spot(
        string Callsign,
        string Mode,
        long FreqHz,
        uint Argb,
        string? Comment);
}
