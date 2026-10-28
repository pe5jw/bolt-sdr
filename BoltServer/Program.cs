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
if (radioIpIdx >= 0 && radioIpIdx + 1 < args.Length)
    options = options with { RadioIp = args[radioIpIdx + 1] };

Console.WriteLine("Bolt SDR starting on http://localhost:" + options.HttpPort);
return await BoltHost.RunAsync(args, options);
