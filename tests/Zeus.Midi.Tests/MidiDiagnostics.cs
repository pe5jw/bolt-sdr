// SPDX-License-Identifier: GPL-2.0-or-later
// MIDI diagnostics test — run manually to debug learn mode issues

using Microsoft.Extensions.Logging;
using Xunit;
using Xunit.Abstractions;

namespace Zeus.Midi.Tests;

public class MidiDiagnostics
{
    private readonly ITestOutputHelper _output;
    private readonly ILogger<DryWetMidiEngine> _log;

    public MidiDiagnostics(ITestOutputHelper output)
    {
        _output = output;
        _log = new TestLogger<DryWetMidiEngine>(output);
    }

    /// <summary>
    /// Manual test — run this while twisting knobs/pressing buttons on your MIDI controller.
    /// It will print every received event to the test output.
    ///
    /// Run with: dotnet test --filter "FullyQualifiedName~MidiDiagnostics.ListenForMidiEvents"
    /// </summary>
    [Fact(Skip = "Manual diagnostics only — remove Skip to run")]
    public async Task ListenForMidiEvents()
    {
        using var engine = new DryWetMidiEngine(_log);

        _output.WriteLine("=== MIDI Diagnostics ===");
        _output.WriteLine($"Engine available: {engine.IsAvailable}");

        var devices = engine.EnumerateDevices();
        _output.WriteLine($"Found {devices.Count} device(s):");
        foreach (var dev in devices)
        {
            _output.WriteLine($"  - {dev.Name} (connected: {dev.Connected})");
        }

        if (!engine.IsAvailable)
        {
            _output.WriteLine("MIDI engine not available on this platform");
            return;
        }

        var messageCount = 0;
        engine.MessageReceived += msg =>
        {
            messageCount++;
            _output.WriteLine($"[{messageCount}] Device: {msg.DeviceName}");
            _output.WriteLine($"    Type: {msg.ControlType}");
            _output.WriteLine($"    Control ID: {msg.ControlId}");
            _output.WriteLine($"    Value: {msg.Value}");
            _output.WriteLine($"    Delta: {msg.Delta}");
            _output.WriteLine("");
        };

        engine.Start();
        _output.WriteLine("\n=== Listening for 30 seconds... twist knobs and press buttons! ===\n");

        await Task.Delay(TimeSpan.FromSeconds(30));

        _output.WriteLine($"\n=== Test complete. Received {messageCount} messages ===");
        engine.Stop();
    }

    private class TestLogger<T> : ILogger<T>
    {
        private readonly ITestOutputHelper _output;
        public TestLogger(ITestOutputHelper output) => _output = output;

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state,
            Exception? exception, Func<TState, Exception?, string> formatter)
        {
            var msg = formatter(state, exception);
            _output.WriteLine($"[{logLevel}] {msg}");
            if (exception != null)
                _output.WriteLine($"  Exception: {exception}");
        }
    }
}
