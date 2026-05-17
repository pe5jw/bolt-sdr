using System.Reflection;
using System.Text.Json;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

namespace Zeus.Plugins.Host.Tests;

/// <summary>
/// Compiles a synthetic plugin assembly into a temp directory and
/// writes a matching plugin.json so PluginLoader can find both. Each
/// fixture is fully isolated — disposing removes the temp dir.
/// </summary>
internal sealed class RoslynFixture : IDisposable
{
    public string PluginDir { get; }
    public string AssemblyName { get; }

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = true,
    };

    private RoslynFixture(string pluginDir, string assemblyName)
    {
        PluginDir = pluginDir;
        AssemblyName = assemblyName;
    }

    /// <summary>
    /// Build a fixture with the supplied C# source and manifest.
    /// <paramref name="csharpSource"/> must define a public type that
    /// implements <c>Zeus.Plugins.Contracts.IZeusPlugin</c>.
    /// </summary>
    public static RoslynFixture Create(
        string assemblyName,
        string csharpSource,
        string manifestJson)
    {
        var tempRoot = Path.Combine(Path.GetTempPath(), "zeus-plugin-fixtures",
            Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempRoot);

        // Reference assemblies — combine two sources:
        //   1. Currently-loaded assemblies (AppDomain.GetAssemblies) —
        //      catches everything actively in use plus its transitive
        //      load graph.
        //   2. Every .dll next to the test binary that wasn't lazy-loaded
        //      yet. AspNetCore.Routing / Builder are typical examples:
        //      the test project references them but they don't load
        //      until used, so GetAssemblies misses them. Filling from
        //      the output dir picks them up unconditionally.
        var byPath = new Dictionary<string, MetadataReference>(StringComparer.OrdinalIgnoreCase);

        foreach (var a in AppDomain.CurrentDomain.GetAssemblies())
        {
            if (a.IsDynamic || string.IsNullOrEmpty(a.Location)) continue;
            if (!File.Exists(a.Location)) continue;
            byPath[a.Location] = MetadataReference.CreateFromFile(a.Location);
        }

        foreach (var dll in Directory.EnumerateFiles(AppContext.BaseDirectory, "*.dll"))
        {
            if (!byPath.ContainsKey(dll))
            {
                try { byPath[dll] = MetadataReference.CreateFromFile(dll); }
                catch { /* non-managed dll, skip */ }
            }
        }

        // The Microsoft.AspNetCore.App shared framework dlls live next
        // to the runtime, not in bin/. Locate the AspNetCore runtime
        // dir from typeof(object)'s installation root and add every
        // .dll under it. Without this, fixtures that implement
        // IBackendPlugin can't compile (Microsoft.AspNetCore.Routing
        // isn't loaded by the test harness on its own).
        var coreDir = Path.GetDirectoryName(typeof(object).Assembly.Location);
        if (coreDir is not null)
        {
            // coreDir = .../shared/Microsoft.NETCore.App/<ver>
            // shared dir is two levels up, then add Microsoft.AspNetCore.App.
            var sharedRoot = Path.GetFullPath(Path.Combine(coreDir, "..", "..", "Microsoft.AspNetCore.App"));
            if (Directory.Exists(sharedRoot))
            {
                var aspnetVersionDir = Directory.EnumerateDirectories(sharedRoot)
                    .OrderByDescending(d => d)
                    .FirstOrDefault();
                if (aspnetVersionDir is not null)
                {
                    foreach (var dll in Directory.EnumerateFiles(aspnetVersionDir, "*.dll"))
                    {
                        if (!byPath.ContainsKey(dll))
                        {
                            try { byPath[dll] = MetadataReference.CreateFromFile(dll); }
                            catch { /* skip */ }
                        }
                    }
                }
            }
        }

        var refs = byPath.Values.ToList();

        // Ensure Zeus.Plugins.Contracts is present even if not yet loaded.
        var contractsAsm = typeof(Zeus.Plugins.Contracts.IZeusPlugin).Assembly;
        if (!refs.Any(r => r.Display?.Contains(Path.GetFileName(contractsAsm.Location)) == true))
            refs.Add(MetadataReference.CreateFromFile(contractsAsm.Location));

        var syntax = CSharpSyntaxTree.ParseText(csharpSource);
        var compilation = CSharpCompilation.Create(
            assemblyName,
            new[] { syntax },
            refs,
            new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));

        var dllPath = Path.Combine(tempRoot, assemblyName + ".dll");
        var emit = compilation.Emit(dllPath);
        if (!emit.Success)
        {
            var diagnostics = string.Join(
                Environment.NewLine,
                emit.Diagnostics.Where(d => d.Severity == DiagnosticSeverity.Error));
            throw new InvalidOperationException("Roslyn compile failed:" + Environment.NewLine + diagnostics);
        }

        File.WriteAllText(Path.Combine(tempRoot, "plugin.json"), manifestJson);
        return new RoslynFixture(tempRoot, assemblyName);
    }

    public void Dispose()
    {
        try { Directory.Delete(PluginDir, recursive: true); }
        catch { /* best effort */ }
    }
}
