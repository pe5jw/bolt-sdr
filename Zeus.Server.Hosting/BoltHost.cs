// SPDX-License-Identifier: GPL-2.0-or-later
//
// Originally part of OpenHPSDR Zeus (GPL v2+)
// Copyright (C) 2025-2026 Brian Keating (EI6LF), Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.
// See ATTRIBUTIONS.md for full provenance.
//
// Modified for Bolt SDR — PE5JW 2026
// Stripped to transceiver core: no plugins, no remote, no chat, no DX cluster,
// no logbook, no support agent, no VST, no KiwiSDR, no WSJT-X integration.

using System.Net;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Zeus.Contracts;
using Zeus.Dsp.Wdsp;
using Zeus.Protocol1;
using Zeus.Protocol1.Discovery;
using Zeus.Server.Diagnostics;
using Zeus.Server.Tci;

namespace Zeus.Server;

public static class BoltHost
{
    public static async Task<int> RunAsync(
        string[] args,
        BoltHostOptions options,
        CancellationToken cancellationToken = default)
    {
        var app = Build(args, options);
        await InitializeAsync(app, cancellationToken);
        try
        {
            await app.RunAsync(cancellationToken);
        }
        catch (Exception ex) when (IsBenignShutdownError(ex))
        {
            Console.Error.WriteLine(
                $"shutdown: ignored benign dispose error: {ex.GetBaseException().Message}");
        }
        return 0;
    }

    private static bool IsBenignShutdownError(Exception ex)
    {
        for (var cur = ex; cur is not null; cur = cur.InnerException)
        {
            if (cur is System.Threading.SynchronizationLockException
                or System.Threading.AbandonedMutexException)
                return true;
            if (cur is ApplicationException &&
                cur.Message.Contains("synchronization method was called from an unsynchronized block",
                    StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    public static WebApplication Build(string[] args, BoltHostOptions options)
    {
        var webRoot = Environment.GetEnvironmentVariable("BOLT_WEBROOT");
        // Lees --webroot argument
        var wrIdx = Array.IndexOf(args, "--webroot");
        if (wrIdx >= 0 && wrIdx + 1 < args.Length) webRoot = args[wrIdx + 1];
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            Args = args,
            ContentRootPath = AppContext.BaseDirectory,
            WebRootPath = string.IsNullOrWhiteSpace(webRoot) ? null : webRoot,
        });

        builder.Services.Configure<Microsoft.Extensions.Hosting.HostOptions>(o =>
            o.BackgroundServiceExceptionBehavior =
                Microsoft.Extensions.Hosting.BackgroundServiceExceptionBehavior.Ignore);

        builder.Services.Configure<JsonOptions>(o =>
        {
            var json = o.SerializerOptions;
            json.TypeInfoResolverChain.Insert(0, Diagnostics.DiagnosticsJsonContext.Default);
            if (!json.TypeInfoResolverChain
                    .OfType<System.Text.Json.Serialization.Metadata.DefaultJsonTypeInfoResolver>()
                    .Any())
                json.TypeInfoResolverChain.Add(
                    new System.Text.Json.Serialization.Metadata.DefaultJsonTypeInfoResolver());
            json.Converters.Add(new JsonStringEnumConverter());
        });

        var diagnosticLogBuffer = new DiagnosticLogBuffer();
        builder.Services.AddSingleton(diagnosticLogBuffer);
        var diagnosticLogFileSink = new DiagnosticLogFileSink(PrefsDbPath.AppLogPath());
        builder.Services.AddSingleton<IDiagnosticLogFileSink>(diagnosticLogFileSink);
        builder.Logging.AddProvider(
            new RingBufferLoggerProvider(diagnosticLogBuffer, diagnosticLogFileSink));

        var tciSection = builder.Configuration.GetSection("Tci");
        var tciEnabled = tciSection.GetValue<bool>("Enabled");
        var tciBindAddress = tciSection.GetValue<string?>("BindAddress") ?? "127.0.0.1";
        var tciPort = tciSection.GetValue<int?>("Port") ?? 40001;

        TciRuntimeConfig? persistedTci = null;
        try
        {
            using var s = new TciConfigStore(NullLogger<TciConfigStore>.Instance);
            persistedTci = s.Get();
        }
        catch (Exception ex) { Console.Error.WriteLine($"tci bootstrap: {ex.Message}"); }
        if (persistedTci is not null)
        {
            tciEnabled = persistedTci.Enabled;
            tciBindAddress = persistedTci.BindAddress;
            tciPort = persistedTci.Port;
        }

        CatRuntimeConfig? persistedCat = null;
        try
        {
            using var s = new CatConfigStore(NullLogger<CatConfigStore>.Instance);
            persistedCat = s.Get();
        }
        catch (Exception ex) { Console.Error.WriteLine($"cat bootstrap: {ex.Message}"); }
        if (persistedCat is not null)
        {
            builder.Services.PostConfigure<Cat.CatOptions>(o =>
            {
                o.Enabled = persistedCat.Enabled;
                o.Port = persistedCat.Port;
                o.BindAddress = persistedCat.BindAddress;
            });
        }

        builder.WebHost.ConfigureKestrel(k =>
        {
            if (options.BindAllInterfaces)
                k.ListenAnyIP(options.HttpPort);
            else
                k.Listen(IPAddress.Loopback, options.HttpPort);

            if (tciEnabled)
            {
                if (IPAddress.TryParse(tciBindAddress, out var tciIp))
                    k.Listen(tciIp, tciPort);
                else
                    k.Listen(IPAddress.Loopback, tciPort);
            }
        });

        // HTTPS LAN cert
        if (options.UseHttps && options.HttpsPort > 0)
        {
            builder.WebHost.ConfigureKestrel(k =>
            {
                var cert = LanCertificate.GetOrCreate();
                if (options.BindAllInterfaces)
                    k.ListenAnyIP(options.HttpsPort, o => o.UseHttps(cert));
                else
                    k.Listen(IPAddress.Loopback, options.HttpsPort, o => o.UseHttps(cert));
            });
        }

        builder.Services.AddSignalR();
        builder.Services.AddCors();

        // Radio discovery
        // Bolt SDR: RadioDiscoveryOptions removed
        builder.Services.AddSingleton<IRadioDiscovery, RadioDiscoveryService>();
        builder.Services.AddSingleton<
            Zeus.Protocol2.Discovery.IRadioDiscovery,
            Zeus.Protocol2.Discovery.RadioDiscoveryService>();

        // Protocol / IQ ring
        builder.Services.AddSingleton<Zeus.Protocol1.TxIqRing>();
        builder.Services.AddSingleton<Zeus.Protocol1.ITxIqSource>(sp =>
            sp.GetRequiredService<Zeus.Protocol1.TxIqRing>());
        builder.Services.AddSingleton<Zeus.Protocol1.RxAudioRing>();
        builder.Services.AddSingleton<Zeus.Protocol1.IRxAudioSource>(sp =>
            sp.GetRequiredService<Zeus.Protocol1.RxAudioRing>());

        // Capabilities
        // Bolt SDR: not a service
        builder.Services.AddSingleton<CapabilitiesService>();
        // Bolt SDR: not a service
        // Bolt SDR: not a service

        // WDSP wisdom initializer
        builder.Services.AddSingleton<Zeus.Dsp.Wdsp.WdspWisdomInitializer>();

                // DSP pipeline
        builder.Services.AddSingleton<WisdomBootstrapService>();
        builder.Services.AddHostedService(sp => sp.GetRequiredService<WisdomBootstrapService>());
        builder.Services.AddSingleton<DspPipelineService>();
        builder.Services.AddHostedService(sp => sp.GetRequiredService<DspPipelineService>());

        // Radio
        builder.Services.AddSingleton<RadioService>();
        builder.Services.AddSingleton<TxService>();
        // TxService is not IHostedService
        builder.Services.AddSingleton<RadioReclaimService>();
        // RadioReclaimService is not IHostedService

        // Audio
        // Bolt SDR: not a service
        // Bolt SDR: not a service
        builder.Services.AddSingleton<NativeAudioSink>();
        builder.Services.AddSingleton<RadioSpeakerAudioSink>();
        builder.Services.AddSingleton<IRxAudioSink, WebSocketAudioSink>();
        builder.Services.AddSingleton<NativeMicCapture>();
        builder.Services.AddHostedService(sp => sp.GetRequiredService<NativeMicCapture>());
        builder.Services.AddSingleton<TxAudioIngest>();
        // TxAudioIngest is not IHostedService
        builder.Services.AddSingleton<P1RadioMicReceiver>();
        builder.Services.AddSingleton<RadioMicReceiver>();
        builder.Services.AddSingleton<TxMicBlockResampler>();
        builder.Services.AddSingleton<WebSocketAudioSink>();
        builder.Services.AddSingleton<GatedWebSocketAudioSink>();

        // TX
        builder.Services.AddSingleton<TxMetersService>();
        builder.Services.AddSingleton<TxTuneDriver>();
        builder.Services.AddHostedService(sp => sp.GetRequiredService<TxTuneDriver>());
        builder.Services.AddSingleton<ExternalPttService>();
        builder.Services.AddSingleton<SignalJammerTxSource>();

        // Streaming hub
        builder.Services.AddSingleton<StreamingHub>();

        // Meters
        // Bolt SDR: not a service
        // Bolt SDR: not a service

        // Band plan
        builder.Services.AddSingleton<BandPlanService>();
        builder.Services.AddSingleton<IBandPlanService>(sp => sp.GetRequiredService<BandPlanService>());
        // Bolt SDR: not a service

        // Settings stores
        builder.Services.AddSingleton<RadioStateStore>();
        builder.Services.AddSingleton<DspSettingsStore>();
        builder.Services.AddSingleton<FilterPresetStore>();
        builder.Services.AddSingleton<CfcPresetStore>();
        builder.Services.AddSingleton<BandMemoryStore>();
        builder.Services.AddSingleton<BandPrefsStore>();
        builder.Services.AddSingleton<BandPlanStore>();
        builder.Services.AddSingleton<PaSettingsStore>();
        builder.Services.AddSingleton<PsSettingsStore>();
        builder.Services.AddSingleton<PttSettingsStore>();
        builder.Services.AddSingleton<AudioSettingsStore>();
        builder.Services.AddSingleton<AudioDeviceSettingsStore>();
        builder.Services.AddSingleton<RadioSpeakerSettingsStore>();
        builder.Services.AddSingleton<DisplaySettingsStore>();
        builder.Services.AddSingleton<DisplayIntelligenceSettingsStore>();
        builder.Services.AddSingleton<CwSettingsStore>();
        builder.Services.AddSingleton<AntennaSettingsStore>();
        builder.Services.AddSingleton<RfFilterSettingsStore>();
        builder.Services.AddSingleton<TxFidelityPolicyStore>();
        builder.Services.AddSingleton<TxStationProfileStore>();
        builder.Services.AddSingleton<PreferredRadioStore>();
        builder.Services.AddSingleton<LayoutStore>();
        builder.Services.AddSingleton<WindowGeometryStore>();
        builder.Services.AddSingleton<ToolbarSettingsStore>();
        builder.Services.AddSingleton<ThemeSettingsStore>();
        builder.Services.AddSingleton<BottomPinStore>();
        builder.Services.AddSingleton<PanWfSplitStore>();
        builder.Services.AddSingleton<Hl2GpioSettingsStore>();

        // PureSignal
        builder.Services.AddSingleton<PsAutoAttenuateService>();
        builder.Services.AddHostedService(sp => sp.GetRequiredService<PsAutoAttenuateService>());

        // Frequency calibration
        builder.Services.AddSingleton<FrequencyCalibrationService>();

        // CW
        builder.Services.AddSingleton<CwEngine>();
        // Bolt SDR: not a service
        builder.Services.AddSingleton<CwSidetoneSource>();
        // Bolt SDR: not a service

        // G2 front panel
        builder.Services.AddSingleton<FrontPanel.G2FrontPanelService>();
        builder.Services.AddHostedService(sp =>
            sp.GetRequiredService<FrontPanel.G2FrontPanelService>());
        builder.Services.AddSingleton<FrontPanel.G2PanelSettingsStore>();

        // CAT
        builder.Services.Configure<Cat.CatOptions>(builder.Configuration.GetSection("Cat"));
        builder.Services.AddSingleton<CatManagementService>();
        // CatManagementService is not IHostedService
        builder.Services.AddSingleton<CatConfigStore>();
        builder.Services.AddSingleton<CatSerialConfigStore>();

        // MIDI
        builder.Services.AddSingleton<Zeus.Midi.IMidiEngine>(sp =>
            new Zeus.Midi.DryWetMidiEngine(sp.GetRequiredService<ILogger<Zeus.Midi.DryWetMidiEngine>>()));
        builder.Services.AddSingleton<Zeus.Midi.IStreamDeckEngine>(sp =>
            new Zeus.Midi.HidStreamDeckEngine(sp.GetRequiredService<ILogger<Zeus.Midi.HidStreamDeckEngine>>()));
        builder.Services.AddSingleton<Midi.MidiService>();
        builder.Services.AddHostedService(sp => sp.GetRequiredService<Midi.MidiService>());
        builder.Services.AddSingleton<Midi.MidiConfigStore>();

        // TCI
        builder.Services.AddSingleton<Zeus.Server.Tci.SpotManager>();
        if (tciEnabled)
        {
            builder.Services.AddSingleton<TciServer>();
            builder.Services.AddHostedService(sp => sp.GetRequiredService<TciServer>());
        }
        builder.Services.AddSingleton<TciConfigStore>();
        builder.Services.AddSingleton<TciManagementService>();

        // Diagnostics
        builder.Services.AddSingleton<DiagnosticsProviderRegistry>();
        builder.Services.AddSingleton<DiagnosticReportBuilder>();
        // Bolt SDR: not a service
        // Bolt SDR: not a service
        builder.Services.AddSingleton<FrontendDspSceneDiagnosticsService>();
        builder.Services.AddSingleton<FrontendAudioPlaybackDiagnosticsService>();
        builder.Services.AddSingleton<HardwareDiagnosticsService>();
        builder.Services.AddSingleton<BoundedShutdown>();
        // Bolt SDR: not a service
        builder.Services.AddSingleton<WidebandSpectrumAnalyzer>();

        // Windows firewall
        builder.Services.AddSingleton<WindowsFirewallService>();
        builder.Services.AddSingleton<IWindowsFirewallService, WindowsFirewallService>();

        // Auto-connect
        builder.Services.AddSingleton<AutoConnectSettingsStore>();
        builder.Services.AddHostedService<AutoConnectService>();

        // App restart
        builder.Services.AddSingleton<AppRestartService>();

        var app = builder.Build();

        app.UseCors(p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
        app.UseStaticFiles(new StaticFileOptions
        {
            OnPrepareResponse = ctx =>
            {
                ctx.Context.Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
                ctx.Context.Response.Headers["Pragma"] = "no-cache";
                ctx.Context.Response.Headers["Expires"] = "0";
            }
        });
        app.UseRouting();
        app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(30) });
        app.MapBoltEndpoints();
        app.MapFallbackToFile("index.html");

        return app;
    }

    public static async Task InitializeAsync(
        WebApplication app,
        CancellationToken cancellationToken = default)
    {
        await Task.CompletedTask;
    }

    static void PrintBanner(int httpPort, bool tciEnabled, string tciBindAddress, int tciPort)
    {
        var assembly = System.Reflection.Assembly.GetExecutingAssembly();
        var attr = assembly
            .GetCustomAttributes(typeof(System.Reflection.AssemblyInformationalVersionAttribute), false)
            .FirstOrDefault() as System.Reflection.AssemblyInformationalVersionAttribute;
        var version = attr?.InformationalVersion ?? "unknown";

        Console.WriteLine();
        Console.WriteLine(new string('─', 60));
        Console.WriteLine("  Bolt SDR — OpenHPSDR Protocol 1 / Protocol 2");
        Console.WriteLine($"  Version : {version}");
        Console.WriteLine("  Based on OpenHPSDR Zeus (GPL-2.0-or-later)");
        Console.WriteLine("  Modified by PE5JW 2026");
        Console.WriteLine(new string('─', 60));
        Console.WriteLine();
        Console.WriteLine($"  http://localhost:{httpPort}");
        if (tciEnabled)
            Console.WriteLine($"  TCI: {tciBindAddress}:{tciPort}");
        Console.WriteLine();
        Console.WriteLine("  Press Ctrl+C to stop.");
        Console.WriteLine();
    }
}

public sealed class BoltHostOptions
{
    public int HttpPort { get; init; } = 6061;
    public int HttpsPort { get; init; } = 6443;
    public bool BindAllInterfaces { get; init; } = true;
    public bool UseHttps { get; init; } = true;
}















