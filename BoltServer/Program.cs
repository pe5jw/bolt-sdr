using Zeus.Server;
var options = new BoltHostOptions
{
    HttpPort = 6061,
    HttpsPort = 6443,
    BindAllInterfaces = true,
    UseHttps = true,
};
Console.WriteLine("Bolt SDR starting on http://localhost:" + options.HttpPort);
return await BoltHost.RunAsync(args, options);
