// SPDX-License-Identifier: GPL-2.0-or-later

namespace Zeus.Server.Tests;

public sealed class HamClockServiceTests
{
    [Fact]
    public void CreateToolProcessStartInfo_UsesBundledNodePathWhenAvailable()
    {
        var root = Path.Combine(Path.GetTempPath(), "zeus-hamclock-node-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var nodePath = Path.Combine(root, OperatingSystem.IsWindows() ? "node.exe" : "node");
            File.WriteAllText(nodePath, string.Empty);

            var psi = HamClockService.CreateToolProcessStartInfo("node", "--version", Path.GetTempPath(), root);

            Assert.Equal(nodePath, psi.FileName);
            Assert.Equal("--version", psi.Arguments);
            var path = psi.Environment.First(kv => string.Equals(kv.Key, "PATH", StringComparison.OrdinalIgnoreCase)).Value;
            Assert.StartsWith(root + Path.PathSeparator, path);
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void ReadEnvPortFromContent_UsesFirstUncommentedPort()
    {
        const string env = """
            # PORT=3001
            HOST=localhost
            PORT=59950
            """;

        Assert.Equal(59950, HamClockService.ReadEnvPortFromContent(env));
    }

    [Fact]
    public void BuildEnvContent_UpsertsStablePortAndPersistenceSettings()
    {
        const string env = """
            PORT=3001
            AUTO_UPDATE_ENABLED=true
            SETTINGS_SYNC=false
            LOCATOR=FN31
            """;

        var updated = HamClockService.BuildEnvContent(env, 59950);

        Assert.Contains("PORT=59950", updated);
        Assert.Contains("AUTO_UPDATE_ENABLED=false", updated);
        Assert.Contains("SETTINGS_SYNC=true", updated);
        Assert.Contains("LOCATOR=FN31", updated);
        Assert.DoesNotContain("PORT=3001", updated);
    }

    [Fact]
    public void ResolvePortForStart_PrefersSavedPortForStableBrowserOrigin()
    {
        var port = HamClockService.ResolvePortForStart(
            overridePort: null,
            savedPort: 51234,
            isAvailable: _ => true,
            freePort: () => 61000);

        Assert.Equal(51234, port);
    }

    [Fact]
    public void ResolvePortForStart_FallsBackWhenSavedPortUnavailable()
    {
        var port = HamClockService.ResolvePortForStart(
            overridePort: null,
            savedPort: 51234,
            isAvailable: p => p == HamClockService.DefaultStablePort,
            freePort: () => 61000);

        Assert.Equal(HamClockService.DefaultStablePort, port);
    }

    [Fact]
    public void InjectZeusCatBridgeTag_AddsBridgeOnceBeforeHeadClose()
    {
        const string html = """
            <!doctype html>
            <html>
              <head>
                <title>HamClock</title>
              </head>
              <body></body>
            </html>
            """;

        var updated = HamClockService.InjectZeusCatBridgeTag(html);
        var second = HamClockService.InjectZeusCatBridgeTag(updated);

        Assert.Contains($"<script src=\"/{HamClockService.ZeusCatBridgeScriptName}\" defer></script>", updated);
        Assert.True(updated.IndexOf(HamClockService.ZeusCatBridgeScriptName, StringComparison.Ordinal) < updated.IndexOf("</head>", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(updated, second);
    }
}
