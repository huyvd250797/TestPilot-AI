using System.Text.Json.Serialization;

namespace TestPilot.WindowsAgent.Models;

public sealed record AgentSettings(string ControlPlaneUrl, string SharedSecret, Guid RunnerId, string RunnerName, int PollSeconds = 3)
{
    public static AgentSettings FromEnvironment()
    {
        var url = Environment.GetEnvironmentVariable("TESTPILOT_CONTROL_PLANE_URL")?.Trim().TrimEnd('/')
            ?? throw new InvalidOperationException("TESTPILOT_CONTROL_PLANE_URL is required.");
        var secret = Environment.GetEnvironmentVariable("TESTPILOT_RUNNER_SHARED_SECRET")?.Trim()
            ?? throw new InvalidOperationException("TESTPILOT_RUNNER_SHARED_SECRET is required.");
        var name = Environment.GetEnvironmentVariable("TESTPILOT_RUNNER_NAME")?.Trim();
        if (string.IsNullOrWhiteSpace(name)) name = Environment.MachineName;
        var pollRaw = Environment.GetEnvironmentVariable("TESTPILOT_POLL_SECONDS");
        var poll = int.TryParse(pollRaw, out var parsed) ? Math.Clamp(parsed, 2, 30) : 3;
        return new AgentSettings(url, secret, RunnerIdentity.Resolve(), name!, poll);
    }
}

internal static class RunnerIdentity
{
    public static Guid Resolve()
    {
        var configured = Environment.GetEnvironmentVariable("TESTPILOT_RUNNER_ID");
        if (Guid.TryParse(configured, out var id)) return id;
        var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TestPilot");
        Directory.CreateDirectory(dir);
        var file = Path.Combine(dir, "runner-id.txt");
        if (File.Exists(file) && Guid.TryParse(File.ReadAllText(file).Trim(), out id)) return id;
        id = Guid.NewGuid(); File.WriteAllText(file, id.ToString()); return id;
    }
}

public sealed record PlannedStep(string Kind, string Instruction, string? Expected, string? CaptureKey);
public sealed record PlannedCase(string Source, string? AcRef, string Title, string[] Preconditions, Dictionary<string,string> TestData, string Expected, PlannedStep[] Steps);
public sealed record WindowsJobPayload(string AppPath, string? AppArgs, PlannedCase TestCase, bool KeepData, bool CloseAppAfterRun);
public sealed record RunnerJob(Guid Id, Guid RunId, string Platform, WindowsJobPayload Payload);
public sealed record PollResponse(RunnerJob? Job);

public sealed record UiElementSnapshot(int Index, string? AutomationId, string? Name, string? ControlType, string? ClassName, bool? Enabled, bool? Offscreen);
public sealed record ControlTarget(string? AutomationId, string? Name, string? ControlType);
public sealed record ResolverCommand(string Type, ControlTarget? Target, string? Value, int? WaitMs);
public sealed record ResolverResult(string Outcome, ResolverCommand? Command, ControlTarget? Target, string? CaptureProperty, bool? Passed, string? Actual, string? Evidence, string? Reason);

public sealed record StepReport(
    Guid RunnerId, Guid RunId, int StepNo, string Kind, string Instruction, string? Expected,
    string Actual, string Result, Dictionary<string,object>? CapturedOutput, string? ScreenshotBase64,
    string StartedAt, string EndedAt);
