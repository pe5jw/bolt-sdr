using Zeus.Contracts;
using Zeus.Server.Tci;

namespace Zeus.Server.Tests.Tci;

public class TciProtocolTests
{
    [Fact]
    public void Command_WithNoArgs_ReturnsSemicolonTerminated()
    {
        var result = TciProtocol.Command("ready");
        Assert.Equal("ready;", result);
    }

    [Fact]
    public void Command_WithSingleArg_FormatsCorrectly()
    {
        var result = TciProtocol.Command("device", "Zeus");
        Assert.Equal("device:Zeus;", result);
    }

    [Fact]
    public void Command_WithMultipleArgs_CommaSeparated()
    {
        var result = TciProtocol.Command("vfo", 0, 0, 14074000);
        Assert.Equal("vfo:0,0,14074000;", result);
    }

    [Fact]
    public void Command_WithBoolArgs_FormatsAsLowercase()
    {
        var result1 = TciProtocol.Command("mute", true);
        var result2 = TciProtocol.Command("mute", false);
        Assert.Equal("mute:true;", result1);
        Assert.Equal("mute:false;", result2);
    }

    [Fact]
    public void Command_WithDoubleArg_FormatsWithDecimal()
    {
        var result = TciProtocol.Command("volume", -12.5);
        Assert.Equal("volume:-12.5;", result);
    }

    [Fact]
    public void Parse_BareCommand_ReturnsCommandWithEmptyArgs()
    {
        var parsed = TciProtocol.Parse("ready;");
        Assert.NotNull(parsed);
        Assert.Equal("ready", parsed.Value.command);
        Assert.Empty(parsed.Value.args);
    }

    [Fact]
    public void Parse_CommandWithArgs_SplitsCorrectly()
    {
        var parsed = TciProtocol.Parse("vfo:0,0,14074000;");
        Assert.NotNull(parsed);
        Assert.Equal("vfo", parsed.Value.command);
        Assert.Equal(3, parsed.Value.args.Length);
        Assert.Equal("0", parsed.Value.args[0]);
        Assert.Equal("0", parsed.Value.args[1]);
        Assert.Equal("14074000", parsed.Value.args[2]);
    }

    [Fact]
    public void Parse_WithoutTrailingSemicolon_StillWorks()
    {
        var parsed = TciProtocol.Parse("modulation:0,USB");
        Assert.NotNull(parsed);
        Assert.Equal("modulation", parsed.Value.command);
        Assert.Equal(2, parsed.Value.args.Length);
    }

    [Fact]
    public void Parse_EmptyString_ReturnsNull()
    {
        var parsed = TciProtocol.Parse("");
        Assert.Null(parsed);
    }

    [Fact]
    public void Parse_Whitespace_ReturnsNull()
    {
        var parsed = TciProtocol.Parse("   ");
        Assert.Null(parsed);
    }

    [Theory]
    [InlineData(RxMode.AM, "AM")]
    [InlineData(RxMode.SAM, "SAM")]
    [InlineData(RxMode.DSB, "DSB")]
    [InlineData(RxMode.LSB, "LSB")]
    [InlineData(RxMode.USB, "USB")]
    [InlineData(RxMode.FM, "FM")]
    [InlineData(RxMode.CWL, "CWL")]
    [InlineData(RxMode.CWU, "CWU")]
    [InlineData(RxMode.DIGL, "DIGL")]
    [InlineData(RxMode.DIGU, "DIGU")]
    public void ModeToTci_AllModes_UpperCase(RxMode mode, string expected)
    {
        var result = TciProtocol.ModeToTci(mode);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("AM", RxMode.AM)]
    [InlineData("am", RxMode.AM)]
    [InlineData("SAM", RxMode.SAM)]
    [InlineData("LSB", RxMode.LSB)]
    [InlineData("lsb", RxMode.LSB)]
    [InlineData("USB", RxMode.USB)]
    [InlineData("FM", RxMode.FM)]
    [InlineData("NFM", RxMode.FM)] // NFM alias
    [InlineData("CWL", RxMode.CWL)]
    [InlineData("CWU", RxMode.CWU)]
    [InlineData("DIGL", RxMode.DIGL)]
    [InlineData("DIGU", RxMode.DIGU)]
    public void TciToMode_ValidModes_CaseInsensitive(string tciMode, RxMode expected)
    {
        var result = TciProtocol.TciToMode(tciMode);
        Assert.NotNull(result);
        Assert.Equal(expected, result.Value);
    }

    [Fact]
    public void TciToMode_UnknownMode_ReturnsNull()
    {
        var result = TciProtocol.TciToMode("INVALID");
        Assert.Null(result);
    }

    [Theory]
    [InlineData("true", true)]
    [InlineData("TRUE", true)]
    [InlineData("True", true)]
    [InlineData("false", false)]
    [InlineData("FALSE", false)]
    [InlineData("False", false)]
    public void TryParseBool_ValidValues_ParsesCorrectly(string input, bool expected)
    {
        bool success = TciProtocol.TryParseBool(input, out bool value);
        Assert.True(success);
        Assert.Equal(expected, value);
    }

    [Theory]
    [InlineData("1")]
    [InlineData("0")]
    [InlineData("yes")]
    [InlineData("no")]
    [InlineData("")]
    public void TryParseBool_InvalidValues_ReturnsFalse(string input)
    {
        bool success = TciProtocol.TryParseBool(input, out _);
        Assert.False(success);
    }

    [Theory]
    [InlineData("42", 42)]
    [InlineData("-10", -10)]
    [InlineData("0", 0)]
    public void TryParseInt_ValidValues_ParsesCorrectly(string input, int expected)
    {
        bool success = TciProtocol.TryParseInt(input, out int value);
        Assert.True(success);
        Assert.Equal(expected, value);
    }

    [Theory]
    [InlineData("14074000", 14074000L)]
    [InlineData("61440000", 61440000L)]
    public void TryParseLong_ValidValues_ParsesCorrectly(string input, long expected)
    {
        bool success = TciProtocol.TryParseLong(input, out long value);
        Assert.True(success);
        Assert.Equal(expected, value);
    }

    [Theory]
    [InlineData("-12.5", -12.5)]
    [InlineData("0.0", 0.0)]
    [InlineData("80.0", 80.0)]
    public void TryParseDouble_ValidValues_ParsesCorrectly(string input, double expected)
    {
        bool success = TciProtocol.TryParseDouble(input, out double value);
        Assert.True(success);
        Assert.Equal(expected, value, precision: 5);
    }
}
