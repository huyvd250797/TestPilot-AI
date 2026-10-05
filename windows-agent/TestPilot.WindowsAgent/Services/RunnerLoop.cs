using System.Text.RegularExpressions;
using TestPilot.WindowsAgent.Models;

namespace TestPilot.WindowsAgent.Services;

public sealed class RunnerLoop
{
    private readonly AgentSettings _settings;
    private readonly ControlPlaneClient _api;

    public RunnerLoop(AgentSettings settings)
    {
        _settings = settings;
        _api = new ControlPlaneClient(settings);
    }

    public async Task RunAsync(CancellationToken ct)
    {
        await RetryAsync(() => _api.RegisterAsync(ct), "register", ct);
        Console.WriteLine($"TestPilot Windows Agent 1.2.0 ONLINE as {_settings.RunnerName} ({_settings.RunnerId})");
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await _api.HeartbeatAsync(null, ct);
                var job = await _api.PollAsync(ct);
                if (job is null) { await Task.Delay(TimeSpan.FromSeconds(_settings.PollSeconds), ct); continue; }
                Console.WriteLine($"Claimed job {job.Id} / run {job.RunId}");
                await _api.HeartbeatAsync(job.Id, ct);
                await ExecuteJobAsync(job, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Runner loop error: {ex.Message}");
                await Task.Delay(TimeSpan.FromSeconds(5), ct);
            }
        }
    }

    private async Task ExecuteJobAsync(RunnerJob job, CancellationToken ct)
    {
        var runtime = new Dictionary<string,string>(job.Payload.TestCase.TestData, StringComparer.OrdinalIgnoreCase);
        var final = "PASS"; string? finalError = null;
        using var session = new WindowsAutomationSession();
        try
        {
            var launchStart = DateTimeOffset.UtcNow;
            session.Launch(job.Payload.AppPath, job.Payload.AppArgs);
            await _api.ReportStepAsync(job.Id, new StepReport(_settings.RunnerId, job.RunId, 0, "act", $"Launch {job.Payload.AppPath}", "Application opens with an accessible main window", $"Main window: {session.WindowTitle}", "PASS", null, SafeScreenshot(session), launchStart.ToString("O"), DateTimeOffset.UtcNow.ToString("O")), ct);

            for (var i = 0; i < job.Payload.TestCase.Steps.Length; i++)
            {
                var source = job.Payload.TestCase.Steps[i];
                var stepNo = i + 1; var started = DateTimeOffset.UtcNow;
                var instruction = ApplyVars(source.Instruction, runtime);
                var expected = string.IsNullOrWhiteSpace(source.Expected) ? job.Payload.TestCase.Expected : ApplyVars(source.Expected!, runtime);
                string actual; string result; Dictionary<string,object>? captured = null;
                try
                {
                    (actual, result, captured) = source.Kind.ToLowerInvariant() switch
                    {
                        "act" => await ExecuteActAsync(session, instruction, expected, ct),
                        "capture" => await ExecuteCaptureAsync(session, instruction, expected, source.CaptureKey, runtime, ct),
                        "verify" => await ExecuteVerifyAsync(session, instruction, expected, ct),
                        _ => ($"Unsupported step kind: {source.Kind}", "BLOCKED", null),
                    };
                }
                catch (Exception ex) { actual = ex.Message; result = "BLOCKED"; captured = null; }

                await _api.ReportStepAsync(job.Id, new StepReport(_settings.RunnerId, job.RunId, stepNo, source.Kind.ToLowerInvariant(), instruction, expected, actual, result, captured, SafeScreenshot(session), started.ToString("O"), DateTimeOffset.UtcNow.ToString("O")), ct);
                Console.WriteLine($"  Step {stepNo}: {result} - {instruction}");
                if (result == "BLOCKED") { final = "BLOCKED"; finalError = actual; break; }
                if (result == "FAIL") final = "FAIL";
            }
        }
        catch (Exception ex) { final = "BLOCKED"; finalError = ex.Message; Console.Error.WriteLine(ex); }
        finally
        {
            if (!job.Payload.CloseAppAfterRun) session.LeaveApplicationRunning();
            await _api.CompleteAsync(job.Id, job.RunId, final, runtime, finalError, ct);
            Console.WriteLine($"Completed job {job.Id}: {final}");
        }
    }

    private async Task<(string actual,string result,Dictionary<string,object>? captured)> ExecuteActAsync(WindowsAutomationSession session, string instruction, string expected, CancellationToken ct)
    {
        var history = new List<string>();
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var resolution = await _api.ResolveAsync("act", instruction, expected, null, session.WindowTitle, session.Snapshot(), history, ct);
            switch (resolution.Outcome.ToUpperInvariant())
            {
                case "DONE": return (resolution.Actual ?? "Action goal achieved.", "PASS", null);
                case "BLOCKED": return (resolution.Reason ?? resolution.Actual ?? "AI could not determine a safe next action.", "BLOCKED", null);
                case "ACTION":
                    if (resolution.Command is null) return ("Resolver returned ACTION without command.", "BLOCKED", null);
                    var actual = session.Execute(resolution.Command); history.Add(actual); break;
                default: return ($"Unexpected resolver outcome for ACT: {resolution.Outcome}", "BLOCKED", null);
            }
        }
        return ("Action guardrail reached 10 observe/action iterations without completing the step.", "BLOCKED", null);
    }

    private async Task<(string actual,string result,Dictionary<string,object>? captured)> ExecuteCaptureAsync(WindowsAutomationSession session, string instruction, string expected, string? captureKey, Dictionary<string,string> runtime, CancellationToken ct)
    {
        var resolution = await _api.ResolveAsync("capture", instruction, expected, captureKey, session.WindowTitle, session.Snapshot(), Array.Empty<string>(), ct);
        if (resolution.Outcome == "BLOCKED") return (resolution.Reason ?? "Capture target could not be determined.", "BLOCKED", null);
        if (resolution.Outcome != "CAPTURE" || resolution.Target is null) return ("Resolver did not return a capture target.", "BLOCKED", null);
        var value = session.CaptureValue(resolution.Target, resolution.CaptureProperty);
        if (!string.IsNullOrWhiteSpace(captureKey)) runtime[captureKey] = value;
        var captured = new Dictionary<string,object>(); if (!string.IsNullOrWhiteSpace(captureKey)) captured[captureKey] = value;
        return ($"Captured {(captureKey ?? "value")} = {value}", "PASS", captured);
    }

    private async Task<(string actual,string result,Dictionary<string,object>? captured)> ExecuteVerifyAsync(WindowsAutomationSession session, string instruction, string expected, CancellationToken ct)
    {
        var resolution = await _api.ResolveAsync("verify", instruction, expected, null, session.WindowTitle, session.Snapshot(), Array.Empty<string>(), ct);
        if (resolution.Outcome == "BLOCKED") return (resolution.Reason ?? "Checkpoint is not observable in the current UI.", "BLOCKED", null);
        if (resolution.Outcome != "VERIFY" || resolution.Passed is null) return ("Resolver did not return a verification decision.", "BLOCKED", null);
        var actual = string.Join(" — ", new[]{resolution.Actual,resolution.Evidence}.Where(x=>!string.IsNullOrWhiteSpace(x)).Select(x=>x!));
        return (string.IsNullOrWhiteSpace(actual) ? "Visible UI evaluated." : actual, resolution.Passed.Value ? "PASS" : "FAIL", null);
    }

    private static string ApplyVars(string text, IReadOnlyDictionary<string,string> vars) => Regex.Replace(text, @"\$\{([^}]+)\}", m => vars.TryGetValue(m.Groups[1].Value, out var v) ? v : m.Value);
    private static string? SafeScreenshot(WindowsAutomationSession session) { try { var s = session.ScreenshotBase64(); return string.IsNullOrWhiteSpace(s) ? null : s; } catch { return null; } }
    private static async Task RetryAsync(Func<Task> work, string name, CancellationToken ct)
    {
        Exception? last = null; for (var i=0;i<5;i++){try{await work();return;}catch(Exception ex){last=ex;Console.Error.WriteLine($"{name} attempt {i+1} failed: {ex.Message}");await Task.Delay(TimeSpan.FromSeconds(2+i*2),ct);}}
        throw last ?? new InvalidOperationException($"Unable to {name}.");
    }
}
