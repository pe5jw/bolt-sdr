using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Zeus.Plugins.Host;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Register the plugin system. The settings store uses the path
    /// returned by <paramref name="prefsDbPathProvider"/> — typically a
    /// thin wrapper around Zeus.Server.PrefsDbPath.Get(). Callers MUST
    /// also call <see cref="MapPluginEndpoints"/> on their endpoint
    /// route builder.
    /// </summary>
    public static IServiceCollection AddZeusPlugins(
        this IServiceCollection services,
        Func<string> prefsDbPathProvider,
        PluginManagerOptions? options = null)
    {
        services.AddSingleton<PluginLoader>();
        services.AddSingleton(sp => new PluginSettingsStore(
            prefsDbPathProvider(),
            sp.GetService<ILogger<PluginSettingsStore>>()));
        services.AddSingleton(sp => new PluginManager(
            loader: sp.GetRequiredService<PluginLoader>(),
            settings: sp.GetRequiredService<PluginSettingsStore>(),
            services: sp,
            logFactory: sp.GetRequiredService<ILoggerFactory>(),
            options: options));
        services.AddHostedService(sp => sp.GetRequiredService<PluginManager>());
        return services;
    }
}
