using FlaUI.Core.AutomationElements;
using FlaUI.Core.Capturing;
using FlaUI.Core.Definitions;
using FlaUI.Core.Input;
using FlaUI.Core.Tools;
using FlaUI.UIA3;
using TestPilot.WindowsAgent.Models;
using FlaApplication = FlaUI.Core.Application;

namespace TestPilot.WindowsAgent.Services;

public sealed class WindowsAutomationSession : IDisposable
{
    private FlaApplication? _application;
    private readonly UIA3Automation _automation = new();
    private Window? _window;
    private bool _closeOnDispose = true;

    public string WindowTitle => _window?.Title ?? "";
    public void LeaveApplicationRunning() => _closeOnDispose = false;

    public void Launch(string appPath, string? args)
    {
        if (!File.Exists(appPath)) throw new FileNotFoundException("Windows test application was not found on this VM.", appPath);
        _application = FlaApplication.Launch(appPath, args ?? "");
        _application.WaitWhileMainHandleIsMissing(TimeSpan.FromSeconds(30));
        for (var i = 0; i < 60 && _window is null; i++)
        {
            try { _window = _application.GetMainWindow(_automation); } catch { }
            if (_window is null) Thread.Sleep(500);
        }
        if (_window is null) throw new InvalidOperationException("No accessible main window was found within 30 seconds.");
        _window.SetForeground();
        Wait.UntilInputIsProcessed(TimeSpan.FromMilliseconds(500));
    }

    public IReadOnlyList<UiElementSnapshot> Snapshot(int max = 220)
    {
        RefreshWindow();
        var items = new List<UiElementSnapshot>();
        var source = new List<AutomationElement> { _window! };
        try { source.AddRange(_window!.FindAllDescendants()); } catch { }
        foreach (var e in source.Take(max))
        {
            try
            {
                items.Add(new UiElementSnapshot(items.Count, Safe(() => e.AutomationId), Safe(() => e.Name), Safe(() => e.ControlType.ToString()), Safe(() => e.ClassName), SafeBool(() => e.IsEnabled), SafeBool(() => e.IsOffscreen)));
            }
            catch { }
        }
        return items;
    }

    public string Execute(ResolverCommand command)
    {
        RefreshWindow();
        var type = command.Type.ToUpperInvariant();
        if (type == "WAIT")
        {
            Thread.Sleep(Math.Clamp(command.WaitMs ?? 800, 100, 10000));
            return $"Waited {command.WaitMs ?? 800} ms";
        }
        if (command.Target is null) throw new InvalidOperationException($"{type} requires a UI target.");
        var element = FindBest(command.Target) ?? throw new InvalidOperationException($"Target not found: {Describe(command.Target)}");
        element.Focus();

        switch (type)
        {
            case "CLICK":
                element.Click();
                break;
            case "CLEAR":
                if (element.ControlType == ControlType.Edit) element.AsTextBox().Text = "";
                else { element.Focus(); Keyboard.TypeSimultaneously(FlaUI.Core.WindowsAPI.VirtualKeyShort.CONTROL, FlaUI.Core.WindowsAPI.VirtualKeyShort.KEY_A); Keyboard.Type(FlaUI.Core.WindowsAPI.VirtualKeyShort.BACK); }
                break;
            case "TYPE":
                if (command.Value is null) throw new InvalidOperationException("TYPE requires value.");
                if (element.ControlType == ControlType.Edit) element.AsTextBox().Text = command.Value;
                else { element.Focus(); Keyboard.Type(command.Value); }
                break;
            case "SELECT":
                if (command.Value is null) throw new InvalidOperationException("SELECT requires value.");
                if (element.ControlType == ControlType.ComboBox)
                {
                    var selected = element.AsComboBox().Select(command.Value);
                    if (selected is null) throw new InvalidOperationException($"ComboBox item '{command.Value}' was not found.");
                }
                else if (element.ControlType == ControlType.List)
                {
                    var selected = element.AsListBox().Select(command.Value);
                    if (selected is null) throw new InvalidOperationException($"List item '{command.Value}' was not found.");
                }
                else throw new InvalidOperationException($"SELECT is not supported for {element.ControlType}.");
                break;
            default:
                throw new InvalidOperationException($"Unsupported command type: {command.Type}");
        }
        Wait.UntilInputIsProcessed(TimeSpan.FromMilliseconds(500));
        Thread.Sleep(250);
        return $"{type} completed on {Describe(element)}";
    }

    public string CaptureValue(ControlTarget target, string? property)
    {
        RefreshWindow();
        var element = FindBest(target) ?? throw new InvalidOperationException($"Capture target not found: {Describe(target)}");
        if (string.Equals(property, "value", StringComparison.OrdinalIgnoreCase))
        {
            if (element.ControlType == ControlType.Edit) return element.AsTextBox().Text ?? "";
            if (element.ControlType == ControlType.ComboBox) return element.AsComboBox().SelectedItem?.Text ?? element.Name ?? "";
        }
        return element.Name ?? "";
    }

    public string ScreenshotBase64()
    {
        var path = Path.Combine(Path.GetTempPath(), $"testpilot-{Guid.NewGuid():N}.png");
        try
        {
            RefreshWindow();
            Capture.Element(_window!).ToFile(path);
            var base64 = Convert.ToBase64String(File.ReadAllBytes(path));
            return base64.Length <= 3_000_000 ? base64 : "";
        }
        finally { try { if (File.Exists(path)) File.Delete(path); } catch { } }
    }

    private void RefreshWindow()
    {
        if (_application is null) throw new InvalidOperationException("Application is not launched.");
        try
        {
            // Prefer a visible enabled top-level window. In WinForms this lets a
            // modal dialog temporarily become the active automation root while
            // the owner window is disabled.
            var top = _application.GetAllTopLevelWindows(_automation);
            var current = top.LastOrDefault(w => !w.IsOffscreen && w.IsEnabled)
                ?? top.LastOrDefault(w => !w.IsOffscreen)
                ?? _application.GetMainWindow(_automation);
            if (current is not null) _window = current;
        }
        catch
        {
            try
            {
                var current = _application.GetMainWindow(_automation);
                if (current is not null) _window = current;
            }
            catch { }
        }
        if (_window is null) throw new InvalidOperationException("No active application window is available.");
    }

    private AutomationElement? FindBest(ControlTarget target)
    {
        // A control type alone is too ambiguous for safe autonomous clicking.
        if (string.IsNullOrWhiteSpace(target.AutomationId) && string.IsNullOrWhiteSpace(target.Name)) return null;
        var all = new List<AutomationElement> { _window! };
        try { all.AddRange(_window!.FindAllDescendants()); } catch { }
        AutomationElement? best = null; var bestScore = -1;
        foreach (var e in all)
        {
            try
            {
                var score = 0;
                var aid = Safe(() => e.AutomationId) ?? ""; var name = Safe(() => e.Name) ?? ""; var ct = Safe(() => e.ControlType.ToString()) ?? "";
                if (!string.IsNullOrWhiteSpace(target.AutomationId)) score += string.Equals(aid, target.AutomationId, StringComparison.OrdinalIgnoreCase) ? 100 : -80;
                if (!string.IsNullOrWhiteSpace(target.Name))
                {
                    if (string.Equals(name, target.Name, StringComparison.OrdinalIgnoreCase)) score += 60;
                    else if (name.Contains(target.Name, StringComparison.OrdinalIgnoreCase) || target.Name.Contains(name, StringComparison.OrdinalIgnoreCase)) score += 25;
                    else score -= 20;
                }
                if (!string.IsNullOrWhiteSpace(target.ControlType)) score += string.Equals(ct, target.ControlType, StringComparison.OrdinalIgnoreCase) ? 20 : -10;
                if (!e.IsEnabled) score -= 20; if (e.IsOffscreen) score -= 10;
                if (score > bestScore) { bestScore = score; best = e; }
            }
            catch { }
        }
        return bestScore >= 20 ? best : null;
    }

    private static string Describe(ControlTarget t) => $"AutomationId='{t.AutomationId}', Name='{t.Name}', ControlType='{t.ControlType}'";
    private static string Describe(AutomationElement e) => $"AutomationId='{Safe(() => e.AutomationId)}', Name='{Safe(() => e.Name)}', ControlType='{Safe(() => e.ControlType.ToString())}'";
    private static string? Safe(Func<string> f) { try { return f(); } catch { return null; } }
    private static bool? SafeBool(Func<bool> f) { try { return f(); } catch { return null; } }

    public void Dispose()
    {
        if (_closeOnDispose) { try { _application?.Close(); } catch { } }
        try { _application?.Dispose(); } catch { }
        _automation.Dispose();
    }
}
