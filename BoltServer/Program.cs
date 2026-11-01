using Zeus.Dsp.Wdsp;
using Zeus.Server;

// --wisdom-worker <dir>  — internal: run WDSPwisdom in this isolated child process.
// If FFTW corrupts the heap and ntdll kills us, only this child dies; the parent
// catches the non-zero exit code and continues without a wisdom cache.
var workerIdx = Array.IndexOf(args, "--wisdom-worker");
if (workerIdx >= 0 && workerIdx + 1 < args.Length)
{
    var dir = args[workerIdx + 1];
    try
    {
        return WdspWisdomInitializer.RunWorker(dir);
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"wdsp.wisdom worker failed: {ex.Message}");
        return 1;
    }
}

var options = new BoltHostOptions
{
    HttpPort = 6061,
    HttpsPort = 6443,
    BindAllInterfaces = true,
    UseHttps = true,
};

// --radio-ip <ip>  — persist a unicast radio IP for autoconnect (cross-subnet / fixed HL2).
//   Saved to the preferences database so it survives restarts even without the arg.
var radioIpIdx = Array.IndexOf(args, "--radio-ip");
string? radioIp = radioIpIdx >= 0 && radioIpIdx + 1 < args.Length
    ? args[radioIpIdx + 1]
    : null;

// Catch any unhandled exception that escapes BoltHost.RunAsync and log it
// before the process exits so the operator can see what went wrong even in a
// transient PowerShell window.
AppDomain.CurrentDomain.UnhandledException += (_, e) =>
{
    Console.Error.WriteLine(
        $"[bolt-sdr FATAL] Unhandled exception (terminating={e.IsTerminating}): {e.ExceptionObject}");
};

Console.WriteLine("Bolt SDR starting on http://localhost:" + options.HttpPort);
int exitCode;
try
{
    exitCode = await BoltHost.RunAsync(args, options, radioIp: radioIp);
}
catch (Exception ex)
{
    Console.Error.WriteLine($"[bolt-sdr FATAL] BoltHost.RunAsync threw: {ex}");
    exitCode = 1;
}
Console.WriteLine($"[bolt-sdr] exiting with code {exitCode}");
return exitCode;
