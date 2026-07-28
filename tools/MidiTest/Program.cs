// SPDX-License-Identifier: GPL-2.0-or-later
// Bolt SDR - Quick MIDI test console app

using Microsoft.Extensions.Logging;
using Zeus.Midi;

Console.WriteLine("=== Bolt SDR - MIDI Quick Test ===\n");

var logFactory = LoggerFactory.Create(builder =>
{
    builder.AddConsole();
    builder.SetMinimumLevel(LogLevel.Debug);
});

var engine = new DryWetMidiEngine(logFactory.CreateLogger<DryWetMidiEngine>());

Console.WriteLine($"Engine available: {engine.IsAvailable}\n");

var devices = engine.EnumerateDevices();
Console.WriteLine($"Found {devices.Count} MIDI device(s):");
foreach (var dev in devices)
{
    Console.WriteLine($"  • {dev.Name} (connected: {dev.Connected})");
}

if (!engine.IsAvailable)
{
    Console.WriteLine("\nMIDI not available on this platform.");
    return;
}

Console.WriteLine("\n=== Listening for MIDI events (30 sec) ===");
Console.WriteLine("Twist knobs, press buttons, move faders...\n");

var count = 0;
engine.MessageReceived += msg =>
{
    count++;
    Console.ForegroundColor = ConsoleColor.Green;
    Console.WriteLine($"[{count}] {msg.DeviceName}");
    Console.ResetColor();
    Console.WriteLine($"    {msg.ControlType,-15} {msg.ControlId,-20} value={msg.Value,3}  delta={msg.Delta,3}");
};

engine.Start();

await Task.Delay(TimeSpan.FromSeconds(30));

Console.WriteLine($"\n=== Done. Received {count} MIDI messages ===");
engine.Stop();
engine.Dispose();
