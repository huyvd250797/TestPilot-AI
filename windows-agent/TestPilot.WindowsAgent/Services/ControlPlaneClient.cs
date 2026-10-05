using System.Net.Http.Json;
using System.Text.Json;
using TestPilot.WindowsAgent.Models;

namespace TestPilot.WindowsAgent.Services;

public sealed class ControlPlaneClient
{
    private readonly HttpClient _http;
    private readonly AgentSettings _settings;
    private readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true };

    public ControlPlaneClient(AgentSettings settings)
    {
        _settings = settings;
        _http = new HttpClient { BaseAddress = new Uri(settings.ControlPlaneUrl + "/"), Timeout = TimeSpan.FromSeconds(70) };
        _http.DefaultRequestHeaders.Add("x-runner-secret", settings.SharedSecret);
    }

    public async Task RegisterAsync(CancellationToken ct)
    {
        var payload = new {
            runnerId = _settings.RunnerId, name = _settings.RunnerName, machineName = Environment.MachineName,
            version = "1.2.0", capabilities = new { uiAutomation = "UIA3", engine = "FlaUI 5.0", screenshots = true, semanticActions = true }
        };
        await SendOkAsync(HttpMethod.Post, "api/runner/register", payload, ct);
    }

    public Task HeartbeatAsync(Guid? currentJobId, CancellationToken ct) => SendOkAsync(HttpMethod.Post, "api/runner/heartbeat", new { runnerId = _settings.RunnerId, currentJobId }, ct);

    public async Task<RunnerJob?> PollAsync(CancellationToken ct)
    {
        using var res = await _http.GetAsync($"api/runner/jobs?runnerId={_settings.RunnerId}", ct);
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<PollResponse>(_json, ct);
        return body?.Job;
    }

    public async Task<ResolverResult> ResolveAsync(string kind, string instruction, string? expected, string? captureKey, string windowTitle, IReadOnlyList<UiElementSnapshot> ui, IReadOnlyList<string> history, CancellationToken ct)
    {
        var payload = new { runnerId = _settings.RunnerId, stepKind = kind, instruction, expected, captureKey, windowTitle, ui, actionHistory = history };
        using var res = await _http.PostAsJsonAsync("api/runner/resolve-action", payload, _json, ct);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<ResolverResult>(_json, ct)) ?? new ResolverResult("BLOCKED", null, null, null, null, null, null, "Empty resolver response.");
    }

    public Task ReportStepAsync(Guid jobId, StepReport report, CancellationToken ct) => SendOkAsync(HttpMethod.Post, $"api/runner/jobs/{jobId}/step", report, ct);

    public Task CompleteAsync(Guid jobId, Guid runId, string result, Dictionary<string,string> runtime, string? error, CancellationToken ct) =>
        SendOkAsync(HttpMethod.Post, $"api/runner/jobs/{jobId}/complete", new { runnerId = _settings.RunnerId, runId, result, runtime, error }, ct);

    private async Task SendOkAsync(HttpMethod method, string path, object payload, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(method, path) { Content = JsonContent.Create(payload, options: _json) };
        using var res = await _http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
        {
            var text = await res.Content.ReadAsStringAsync(ct);
            throw new HttpRequestException($"{path} failed: {(int)res.StatusCode} {text}");
        }
    }
}
