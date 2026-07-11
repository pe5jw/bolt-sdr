namespace Zeus.Server;
internal sealed record Protocol3SidecarDisplayFrame(byte RxId, Zeus.Contracts.DisplayBodyFlags BodyFlags, long CenterHz, float HzPerPixel, float[] PanDb, float[] WfDb, string Source);
