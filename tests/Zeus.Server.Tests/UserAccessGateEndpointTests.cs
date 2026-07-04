using Microsoft.AspNetCore.Http;

namespace Zeus.Server.Tests;

public sealed class UserAccessGateEndpointTests
{
    [Theory]
    [InlineData("POST", "/api/connect/p3", true)]
    [InlineData("POST", "/api/connect/p2", true)]
    [InlineData("POST", "/api/vfo", true)]
    [InlineData("PUT", "/api/support/availability", true)]
    [InlineData("POST", "/api/plugins/checkout", true)]
    [InlineData("POST", "/api/qrz/login", false)]
    [InlineData("POST", "/api/qrz/logout", false)]
    [InlineData("POST", "/api/qrz/apikey", false)]
    [InlineData("POST", "/api/disconnect", false)]
    [InlineData("POST", "/api/disconnect/p2", false)]
    [InlineData("POST", "/api/disconnect/p3", false)]
    [InlineData("GET", "/api/users/session", false)]
    [InlineData("GET", "/api/state", false)]
    [InlineData("POST", "/manual", false)]
    public void Protected_request_classifier_matches_user_access_contract(
        string method,
        string path,
        bool expected)
    {
        Assert.Equal(expected, ZeusEndpoints.IsUserAccessGateProtectedRequest(method, new PathString(path)));
    }
}
