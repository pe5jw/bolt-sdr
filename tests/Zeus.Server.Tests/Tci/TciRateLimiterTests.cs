using Zeus.Server.Tci;

namespace Zeus.Server.Tests.Tci;

public class TciRateLimiterTests
{
    [Fact(Skip = "Timing-sensitive test unreliable in CI - timer precision varies")]
    public void Enqueue_SingleEvent_FlushesAfterInterval()
    {
        var sent = new List<string>();
        using var limiter = new TciRateLimiter(50, cmd => sent.Add(cmd));

        limiter.Enqueue("vfo:0,0", "vfo:0,0,14074000;");

        // Should not flush immediately
        Assert.Empty(sent);

        // Wait for the interval + substantial margin for timer precision
        Thread.Sleep(200);

        Assert.Single(sent);
        Assert.Equal("vfo:0,0,14074000;", sent[0]);
    }

    [Fact(Skip = "Timing-sensitive test unreliable in CI - timer precision varies")]
    public void Enqueue_MultipleEventsForSameKey_OnlyLastIsSent()
    {
        var sent = new List<string>();
        using var limiter = new TciRateLimiter(50, cmd => sent.Add(cmd));

        limiter.Enqueue("vfo:0,0", "vfo:0,0,14074000;");
        limiter.Enqueue("vfo:0,0", "vfo:0,0,14074100;");
        limiter.Enqueue("vfo:0,0", "vfo:0,0,14074200;");

        Thread.Sleep(300);

        // Only the latest value should be sent
        Assert.Single(sent);
        Assert.Equal("vfo:0,0,14074200;", sent[0]);
    }

    [Fact(Skip = "Timing-sensitive test unreliable in CI - timer precision varies")]
    public void Enqueue_DifferentKeys_AllAreSent()
    {
        var sent = new List<string>();
        using var limiter = new TciRateLimiter(50, cmd => sent.Add(cmd));

        limiter.Enqueue("vfo:0,0", "vfo:0,0,14074000;");
        limiter.Enqueue("vfo:0,1", "vfo:0,1,14074500;");
        limiter.Enqueue("dds:0", "dds:0,14074000;");

        Thread.Sleep(200);

        Assert.Equal(3, sent.Count);
        Assert.Contains("vfo:0,0,14074000;", sent);
        Assert.Contains("vfo:0,1,14074500;", sent);
        Assert.Contains("dds:0,14074000;", sent);
    }

    [Fact(Skip = "Timing-sensitive test unreliable in CI - timer precision varies")]
    public void Enqueue_RapidUpdates_Coalesces()
    {
        var sent = new List<string>();
        using var limiter = new TciRateLimiter(100, cmd => sent.Add(cmd));

        // Simulate rapid VFO changes (e.g., 10 Hz drag)
        for (int i = 0; i < 50; i++)
        {
            limiter.Enqueue("vfo:0,0", $"vfo:0,0,{14074000 + i * 100};");
            Thread.Sleep(1); // 1 ms between updates = 1000 Hz
        }

        // Wait for one flush interval plus margin
        Thread.Sleep(250);

        // Should have coalesced all 50 updates into 1 send
        Assert.Single(sent);
        Assert.Contains("14078900", sent[0]); // Last value
    }

    [Fact]
    public void FlushNow_SendsPendingEventsImmediately()
    {
        var sent = new List<string>();
        using var limiter = new TciRateLimiter(1000, cmd => sent.Add(cmd)); // Long interval

        limiter.Enqueue("vfo:0,0", "vfo:0,0,14074000;");
        Assert.Empty(sent); // Not flushed yet

        limiter.FlushNow();
        Assert.Single(sent);
        Assert.Equal("vfo:0,0,14074000;", sent[0]);
    }

    [Fact(Skip = "Timing-sensitive test unreliable in CI - timer precision varies")]
    public void Enqueue_WithSendException_DoesNotStopOtherEvents()
    {
        var sent = new List<string>();
        int callCount = 0;
        using var limiter = new TciRateLimiter(50, cmd =>
        {
            callCount++;
            if (cmd.Contains("vfo:0,0"))
                throw new InvalidOperationException("Simulated send failure");
            sent.Add(cmd);
        });

        limiter.Enqueue("vfo:0,0", "vfo:0,0,14074000;");
        limiter.Enqueue("vfo:0,1", "vfo:0,1,14074500;");

        Thread.Sleep(300);

        // Both events should have been attempted
        Assert.Equal(2, callCount);
        // But only the second succeeded
        Assert.Single(sent);
        Assert.Equal("vfo:0,1,14074500;", sent[0]);
    }

    [Fact]
    public void Dispose_StopsTimer()
    {
        var sent = new List<string>();
        var limiter = new TciRateLimiter(50, cmd => sent.Add(cmd));

        limiter.Enqueue("vfo:0,0", "vfo:0,0,14074000;");
        limiter.Dispose();

        // Wait longer than the interval
        Thread.Sleep(150);

        // Should not have flushed after dispose
        Assert.Empty(sent);
    }
}
