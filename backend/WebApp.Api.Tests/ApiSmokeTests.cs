using Microsoft.AspNetCore.Mvc.Testing;

namespace WebApp.Api.Tests;

public class ApiSmokeTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ApiSmokeTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_Returns200()
    {
        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/health");
        resp.EnsureSuccessStatusCode();
    }
}
