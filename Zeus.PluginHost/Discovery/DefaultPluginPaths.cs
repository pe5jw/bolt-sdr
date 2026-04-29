// DefaultPluginPaths.cs — system + user plugin search roots per platform.
//
// Returned list is filtered to roots that actually exist so callers can
// pass it straight to PluginScanner without having to mkdir the missing
// ones. Order is informational (system first, then user) but not
// load-bearing — PluginScanner sorts the final manifest list by FilePath.
//
// Phase B will fold in user-supplied paths from LiteDB and the plugin
// vendor's "VST3 path" entries from VST3PluginPath.txt files.

using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;

namespace Zeus.PluginHost.Discovery;

public static class DefaultPluginPaths
{
    public static IReadOnlyList<string> ForCurrentPlatform()
    {
        var candidates = RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
            ? WindowsPaths()
            : RuntimeInformation.IsOSPlatform(OSPlatform.OSX)
                ? MacPaths()
                : LinuxPaths();

        var existing = new List<string>(candidates.Count);
        foreach (var path in candidates)
        {
            if (string.IsNullOrWhiteSpace(path)) continue;
            try
            {
                if (Directory.Exists(path)) existing.Add(path);
            }
            catch
            {
                // Best-effort; skip unreadable paths.
            }
        }
        return existing;
    }

    private static IReadOnlyList<string> LinuxPaths()
    {
        var home = Environment.GetEnvironmentVariable("HOME") ?? string.Empty;
        return new[]
        {
            Path.Combine(home, ".vst3"),
            "/usr/lib/vst3",
            "/usr/local/lib/vst3",
            Path.Combine(home, ".lxvst"),
            Path.Combine(home, ".vst"),
            "/usr/lib/vst",
            "/usr/local/lib/vst",
        };
    }

    private static IReadOnlyList<string> WindowsPaths()
    {
        // Environment.GetFolderPath gives us the well-known Program Files
        // and AppData roots; ProgramFilesX86 maps to %CommonProgramFiles(x86)%
        // ancestor but VST plugins use the explicit env var.
        var commonProgramFiles = Environment.GetEnvironmentVariable("CommonProgramFiles") ?? string.Empty;
        var commonProgramFilesX86 = Environment.GetEnvironmentVariable("CommonProgramFiles(x86)") ?? string.Empty;
        var programFiles = Environment.GetEnvironmentVariable("ProgramFiles") ?? string.Empty;
        var programFilesX86 = Environment.GetEnvironmentVariable("ProgramFiles(x86)") ?? string.Empty;
        var appData = Environment.GetEnvironmentVariable("APPDATA") ?? string.Empty;

        return new[]
        {
            Path.Combine(commonProgramFiles, "VST3"),
            Path.Combine(commonProgramFilesX86, "VST3"),
            Path.Combine(programFiles, "VstPlugins"),
            Path.Combine(programFilesX86, "VstPlugins"),
            Path.Combine(appData, "VST3"),
        };
    }

    private static IReadOnlyList<string> MacPaths()
    {
        var home = Environment.GetEnvironmentVariable("HOME") ?? string.Empty;
        return new[]
        {
            "/Library/Audio/Plug-Ins/VST3",
            Path.Combine(home, "Library/Audio/Plug-Ins/VST3"),
            "/Library/Audio/Plug-Ins/VST",
            Path.Combine(home, "Library/Audio/Plug-Ins/VST"),
        };
    }
}
