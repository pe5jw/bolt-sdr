using Zeus.Server.Tci;

namespace Zeus.Server.Tests.Tci;

public class SpotManagerTests
{
    [Fact]
    public void AddSpot_StoresSpot()
    {
        var manager = new SpotManager();
        manager.AddSpot("W1AW", "CW", 14074000, 0xFF00FF00, "CQ DX");

        var spots = manager.GetAll();
        Assert.Single(spots);
        Assert.Equal("W1AW", spots[0].Callsign);
        Assert.Equal("CW", spots[0].Mode);
        Assert.Equal(14074000, spots[0].FreqHz);
        Assert.Equal(0xFF00FF00u, spots[0].Argb);
        Assert.Equal("CQ DX", spots[0].Comment);
    }

    [Fact]
    public void AddSpot_DuplicateCallsign_Overwrites()
    {
        var manager = new SpotManager();
        manager.AddSpot("W1AW", "CW", 14074000, 0xFF00FF00);
        manager.AddSpot("W1AW", "SSB", 14250000, 0xFFFF0000, "Updated");

        var spots = manager.GetAll();
        Assert.Single(spots);
        Assert.Equal("SSB", spots[0].Mode);
        Assert.Equal(14250000, spots[0].FreqHz);
        Assert.Equal("Updated", spots[0].Comment);
    }

    [Fact]
    public void AddSpot_MultipleSpots_StoresAll()
    {
        var manager = new SpotManager();
        manager.AddSpot("W1AW", "CW", 14074000, 0xFF00FF00);
        manager.AddSpot("K3Y", "SSB", 14250000, 0xFFFF0000);
        manager.AddSpot("DL1ABC", "FT8", 14074000, 0xFF0000FF);

        var spots = manager.GetAll();
        Assert.Equal(3, spots.Length);
        Assert.Contains(spots, s => s.Callsign == "W1AW");
        Assert.Contains(spots, s => s.Callsign == "K3Y");
        Assert.Contains(spots, s => s.Callsign == "DL1ABC");
    }

    [Fact]
    public void RemoveSpot_ExistingCallsign_Removes()
    {
        var manager = new SpotManager();
        manager.AddSpot("W1AW", "CW", 14074000, 0xFF00FF00);
        manager.AddSpot("K3Y", "SSB", 14250000, 0xFFFF0000);

        manager.RemoveSpot("W1AW");

        var spots = manager.GetAll();
        Assert.Single(spots);
        Assert.Equal("K3Y", spots[0].Callsign);
    }

    [Fact]
    public void RemoveSpot_NonexistentCallsign_NoOp()
    {
        var manager = new SpotManager();
        manager.AddSpot("W1AW", "CW", 14074000, 0xFF00FF00);

        manager.RemoveSpot("NONEXISTENT");

        var spots = manager.GetAll();
        Assert.Single(spots);
    }

    [Fact]
    public void ClearAll_RemovesAllSpots()
    {
        var manager = new SpotManager();
        manager.AddSpot("W1AW", "CW", 14074000, 0xFF00FF00);
        manager.AddSpot("K3Y", "SSB", 14250000, 0xFFFF0000);
        manager.AddSpot("DL1ABC", "FT8", 14074000, 0xFF0000FF);

        manager.ClearAll();

        var spots = manager.GetAll();
        Assert.Empty(spots);
    }

    [Fact]
    public void GetAll_EmptyManager_ReturnsEmptyArray()
    {
        var manager = new SpotManager();
        var spots = manager.GetAll();
        Assert.Empty(spots);
    }

    [Fact]
    public void AddSpot_NullComment_Allowed()
    {
        var manager = new SpotManager();
        manager.AddSpot("W1AW", "CW", 14074000, 0xFF00FF00, null);

        var spots = manager.GetAll();
        Assert.Single(spots);
        Assert.Null(spots[0].Comment);
    }
}
