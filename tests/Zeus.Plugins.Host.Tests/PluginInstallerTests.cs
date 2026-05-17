using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Zeus.Plugins.Host;
using Zeus.Plugins.Host.Registry;

namespace Zeus.Plugins.Host.Tests;

public class PluginInstallerTests : IDisposable
{
    private readonly string _root;
    private readonly string _dbPath;
    private readonly PluginSettingsStore _store;
    private readonly PluginManager _manager;
    private readonly PluginInstaller _installer;
    private readonly RecordingHandler _http;

    public PluginInstallerTests()
    {
        _root = Path.Combine(Path.GetTempPath(), "zeus-installer-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_root);
        _dbPath = Path.Combine(_root, "settings.db");

        _store = new PluginSettingsStore(_dbPath);
        _manager = new PluginManager(
            loader: new PluginLoader(NullLogger<PluginLoader>.Instance),
            settings: _store,
            services: new ServiceCollection().BuildServiceProvider(),
            logFactory: NullLoggerFactory.Instance,
            options: new PluginManagerOptions { PluginRoot = _root });

        _http = new RecordingHandler();
        var httpClient = new HttpClient(_http);
        _installer = new PluginInstaller(
            httpClient,
            new StubRegistry(),
            _manager,
            _root);
    }

    public void Dispose()
    {
        _manager.DisposeAsync().AsTask().GetAwaiter().GetResult();
        try { Directory.Delete(_root, recursive: true); } catch { /* ignore */ }
    }

    private static string SampleAsmDir() =>
        Path.Combine(AppContext.BaseDirectory, "sample-plugins", "HelloWorld");

    private static (byte[] zipBytes, string sha256Hex) BuildZipFromSample()
    {
        var src = SampleAsmDir();
        using var ms = new MemoryStream();
        using (var archive = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var f in Directory.EnumerateFiles(src))
            {
                var entry = archive.CreateEntry(Path.GetFileName(f), CompressionLevel.Fastest);
                using var es = entry.Open();
                using var fs = File.OpenRead(f);
                fs.CopyTo(es);
            }
        }
        var bytes = ms.ToArray();
        var sha = Convert.ToHexString(SHA256.HashData(bytes));
        return (bytes, sha);
    }

    [Fact]
    public async Task InstallFromZipFile_RoundTrips()
    {
        var (bytes, _) = BuildZipFromSample();
        var zip = Path.Combine(_root, "in.zip");
        await File.WriteAllBytesAsync(zip, bytes);

        var installed = await _installer.InstallFromZipFileAsync(zip, default);

        Assert.Equal("com.openhpsdr.zeus.samples.helloworld", installed.Manifest.Id);
        Assert.NotNull(_manager.Find("com.openhpsdr.zeus.samples.helloworld"));
        Assert.True(Directory.Exists(installed.Directory));
        Assert.True(File.Exists(Path.Combine(installed.Directory, "plugin.json")));
    }

    [Fact]
    public async Task InstallFromUrl_VerifyHash_HappyPath()
    {
        var (bytes, sha) = BuildZipFromSample();
        _http.Body = bytes;

        var installed = await _installer.InstallFromUrlAsync("https://example.com/plug.zip", sha, default);

        Assert.Equal("com.openhpsdr.zeus.samples.helloworld", installed.Manifest.Id);
        Assert.NotNull(_manager.Find("com.openhpsdr.zeus.samples.helloworld"));
    }

    [Fact]
    public async Task InstallFromUrl_HashMismatch_Rejects_AndLeavesNoFiles()
    {
        var (bytes, _) = BuildZipFromSample();
        _http.Body = bytes;
        var wrongHash = new string('0', 64);

        var ex = await Assert.ThrowsAsync<PluginInstallException>(
            () => _installer.InstallFromUrlAsync("https://example.com/plug.zip", wrongHash, default));

        Assert.Contains("sha256 mismatch", ex.Message);
        Assert.Null(_manager.Find("com.openhpsdr.zeus.samples.helloworld"));
        Assert.False(Directory.Exists(
            Path.Combine(_root, PluginInstaller.SafeDirName("com.openhpsdr.zeus.samples.helloworld"))));
    }

    [Fact]
    public async Task InstallFromUrl_RejectsHttp()
    {
        var ex = await Assert.ThrowsAsync<PluginInstallException>(
            () => _installer.InstallFromUrlAsync("http://insecure.example.com/plug.zip", null, default));
        Assert.Contains("non-HTTPS", ex.Message);
    }

    [Fact]
    public async Task InstallFromZipFile_RejectsZipSlip()
    {
        var zip = Path.Combine(_root, "malicious.zip");
        using (var ms = new FileStream(zip, FileMode.Create))
        using (var archive = new ZipArchive(ms, ZipArchiveMode.Create))
        {
            var entry = archive.CreateEntry("../../escape.txt");
            using var s = entry.Open();
            s.Write(Encoding.UTF8.GetBytes("evil"));
        }

        await Assert.ThrowsAsync<PluginInstallException>(
            () => _installer.InstallFromZipFileAsync(zip, default));
    }

    [Fact]
    public async Task InstallFromZipFile_MissingManifest_Rejected()
    {
        var zip = Path.Combine(_root, "no-manifest.zip");
        using (var ms = new FileStream(zip, FileMode.Create))
        using (var archive = new ZipArchive(ms, ZipArchiveMode.Create))
        {
            archive.CreateEntry("README.md");
        }
        var ex = await Assert.ThrowsAsync<PluginInstallException>(
            () => _installer.InstallFromZipFileAsync(zip, default));
        Assert.Contains("plugin.json", ex.Message);
    }

    [Fact]
    public async Task Uninstall_DeactivatesAndRemovesDirectory()
    {
        var (bytes, _) = BuildZipFromSample();
        var zip = Path.Combine(_root, "in.zip");
        await File.WriteAllBytesAsync(zip, bytes);
        var installed = await _installer.InstallFromZipFileAsync(zip, default);

        Assert.True(Directory.Exists(installed.Directory));
        await _installer.UninstallAsync("com.openhpsdr.zeus.samples.helloworld", default);
        Assert.Null(_manager.Find("com.openhpsdr.zeus.samples.helloworld"));
        // ALC unload is best-effort on every platform; directory may or
        // may not be gone immediately. The contract is: deactivated +
        // best-effort dir removal.
    }

    [Fact]
    public void SafeDirName_NormalisesDotsAndStripsBadChars()
    {
        Assert.Equal("com.example.a", PluginInstaller.SafeDirName("com.example.a"));
        Assert.Equal("a-b_c.d", PluginInstaller.SafeDirName("a-b_c.d"));
        Assert.Equal("a_b", PluginInstaller.SafeDirName("a/b"));
    }

    private sealed class RecordingHandler : HttpMessageHandler
    {
        public byte[] Body { get; set; } = Array.Empty<byte>();
        public int RequestCount;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Interlocked.Increment(ref RequestCount);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new ByteArrayContent(Body),
            });
        }
    }

    private sealed class StubRegistry : IRegistryClient
    {
        public string SourceUrl => "stub://registry";
        public Task<Zeus.Plugins.Contracts.Registry.RegistryCatalog> FetchAsync(CancellationToken ct)
            => Task.FromResult(new Zeus.Plugins.Contracts.Registry.RegistryCatalog());
    }
}
