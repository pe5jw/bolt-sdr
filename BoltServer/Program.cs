using Zeus.Server;

var options = new BoltHostOptions
{
    HttpPort = args.Length > 0 && int.TryParse(args[0], out var p) ? p : 6060,
    BindAllInterfaces = args.Contains("--lan"),
};

Console.WriteLine("Bolt SDR starting on http://localhost:" + options.HttpPort);
return await BoltHost.RunAsync(args, options);
