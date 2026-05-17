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

        // Reference assemblies — pull from the test host's resolved
        // assembly list so the synthetic plugin sees exactly the types
        // the host runtime exposes. Filter out anything whose backing
        // file no longer exists on disk (previous test fixture's
        // compiled plugin lingers in AppDomain after we delete the
        // temp dir during Dispose).
        var refs = AppDomain.CurrentDomain.GetAssemblies()
            .Where(a => !a.IsDynamic && !string.IsNullOrEmpty(a.Location))
            .Where(a => File.Exists(a.Location))
            .Select(a => MetadataReference.CreateFromFile(a.Location))
            .Cast<MetadataReference>()
            .ToList();

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
