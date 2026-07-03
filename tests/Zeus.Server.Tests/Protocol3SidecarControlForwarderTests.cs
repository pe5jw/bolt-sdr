using Zeus.Server;

namespace Zeus.Server.Tests;

public sealed class Protocol3SidecarControlForwarderTests
{
    [Fact]
    public void ShouldRefreshPaSnapshotForTxControl_RefreshesActiveMoxWhenDriveByteIsStaleZero()
    {
        Assert.True(Protocol3SidecarControlForwarder.ShouldRefreshPaSnapshotForTxControl(
            active: true,
            tune: false,
            drive: 0,
            drivePct: 43,
            tunePct: 1));
    }

    [Fact]
    public void ShouldRefreshPaSnapshotForTxControl_RefreshesActiveTuneWhenTuneDriveIsNonZero()
    {
        Assert.True(Protocol3SidecarControlForwarder.ShouldRefreshPaSnapshotForTxControl(
            active: true,
            tune: true,
            drive: 0,
            drivePct: 0,
            tunePct: 10));
    }

    [Theory]
    [InlineData(false, false, 0, 43, 1)]
    [InlineData(true, false, 43, 43, 1)]
    [InlineData(true, false, 0, 0, 1)]
    [InlineData(true, true, 0, 43, 0)]
    public void ShouldRefreshPaSnapshotForTxControl_DoesNotRefreshWhenZeroDriveIsIntentional(
        bool active,
        bool tune,
        byte drive,
        int drivePct,
        int tunePct)
    {
        Assert.False(Protocol3SidecarControlForwarder.ShouldRefreshPaSnapshotForTxControl(
            active,
            tune,
            drive,
            drivePct,
            tunePct));
    }
}
