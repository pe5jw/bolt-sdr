using Zeus.Contracts;
namespace Zeus.Server;
public static partial class ZeusEndpoints
{
    internal static SmartNrRxChainRuntimeDto BuildSmartNrRxChainRuntime(StateDto state, AdcProtectionStatusDto adc)
    {
        var agc = state.Agc ?? new AgcConfig();
        var squelch = state.Squelch ?? new SquelchConfig();

        return new(
            SchemaVersion: 2,
            Source: "backend-radio-state",
            FilterLowHz: state.FilterLowHz,
            FilterHighHz: state.FilterHighHz,
            FilterWidthHz: Math.Abs(state.FilterHighHz - state.FilterLowHz),
            FilterPresetName: state.FilterPresetName,
            AutoAgcEnabled: state.AutoAgcEnabled,
            AgcMode: agc.Mode.ToString(),
            AgcTopDb: Math.Round(state.AgcTopDb, 1),
            AgcOffsetDb: Math.Round(state.AgcOffsetDb, 1),
            EffectiveAgcTopDb: Math.Round(state.AgcTopDb + state.AgcOffsetDb, 1),
            AutoAttEnabled: state.AutoAttEnabled,
            AdcProtectionEnabled: adc.Config.Enabled,
            AttenDb: adc.AttenDb,
            AttOffsetDb: adc.OffsetDb,
            EffectiveAttenDb: adc.EffectiveDb,
            AdcOverloadWarning: adc.Warning,
            AdcOverloadLevel: adc.OverloadLevel,
            LastOverloadBits: adc.LastOverloadBits,
            Adc0MaxMagnitude: adc.Adc0MaxMagnitude,
            Adc1MaxMagnitude: adc.Adc1MaxMagnitude,
            Adc0MaxMagnitudeAtOverload: adc.Adc0MaxMagnitudeAtOverload,
            Adc1MaxMagnitudeAtOverload: adc.Adc1MaxMagnitudeAtOverload,
            LastAdcTelemetryUtc: adc.LastTelemetryUtc,
            SquelchEnabled: squelch.Enabled,
            SquelchAdaptive: squelch.Adaptive,
            SquelchLevel: squelch.Level,
            PreampOn: state.PreampOn);
    }

}

