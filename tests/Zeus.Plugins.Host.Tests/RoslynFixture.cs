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

        // Reference assemblies — assembled from three sources in
        // PRIORITY ORDER (first-wins, dedupe by assembly file name so
        // CS1705 version-mismatches don't bite when a runtime-shared
        // framework and a NuGet-package copy of the same dll both
        // surface):
        //
        //   1. Microsoft.AspNetCore.App shared framework — highest
        //      priority. Zeus.Plugins.Contracts.dll links against the
        //      framework's 10.0.x assemblies; CI image's
        //      Microsoft.AspNetCore.Mvc.Testing transitively brings in
        //      9.0.0 copies of Microsoft.AspNetCore.Routing.dll under
        //      bin/, which Roslyn would otherwise prefer.
        //   2. Test binary's output dir — Mvc.Testing infrastructure,
        //      xunit, Zeus assemblies.
        //   3. AppDomain.GetAssemblies() — catches anything loaded
        //      via reflection that wasn't on disk in the above paths.
        var byName = new Dictionary<string, MetadataReference>(StringComparer.OrdinalIgnoreCase);

        void TryAdd(string dllPath)
        {
            var key = Path.GetFileName(dllPath);
            if (byName.ContainsKey(key)) return;
            if (!File.Exists(dllPath)) return;
            try { byName[key] = MetadataReference.CreateFromFile(dllPath); }
            catch { /* non-managed dll, skip */ }
        }

        // 1. Shared framework first — wins ties.
        var coreDir = Path.GetDirectoryName(typeof(object).Assembly.Location);
        if (coreDir is not null)
        {
            var sharedRoot = Path.GetFullPath(Path.Combine(coreDir, "..", "..", "Microsoft.AspNetCore.App"));
            if (Directory.Exists(sharedRoot))
            {
                var aspnetVersionDir = Directory.EnumerateDirectories(sharedRoot)
                    .OrderByDescending(d => d)
                    .FirstOrDefault();
                if (aspnetVersionDir is not null)
                {
                    foreach (var dll in Directory.EnumerateFiles(aspnetVersionDir, "*.dll"))
                        TryAdd(dll);
                }
            }
            // Also the NETCore.App shared framework so System.* refs are present.
            foreach (var dll in Directory.EnumerateFiles(coreDir, "*.dll"))
                TryAdd(dll);
        }

        // 2. Test binary's output dir.
        foreach (var dll in Directory.EnumerateFiles(AppContext.BaseDirectory, "*.dll"))
            TryAdd(dll);

        // 3. Anything loaded via reflection not yet covered.
        foreach (var a in AppDomain.CurrentDomain.GetAssemblies())
        {
            if (a.IsDynamic || string.IsNullOrEmpty(a.Location)) continue;
            TryAdd(a.Location);
        }

        var refs = byName.Values.ToList();

        // Ensure Zeus.Plugins.Contracts is present even if not yet
        // loaded (it isn't in any of the dirs above — lives in
        // this test project's bin via ProjectReference output).
        var contractsAsm = typeof(Zeus.Plugins.Contracts.IZeusPlugin).Assembly;
        var contractsName = Path.GetFileName(contractsAsm.Location);
        if (!byName.ContainsKey(contractsName))
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
