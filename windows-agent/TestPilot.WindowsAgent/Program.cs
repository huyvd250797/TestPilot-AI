using TestPilot.WindowsAgent.Models;
using TestPilot.WindowsAgent.Services;

namespace TestPilot.WindowsAgent;

internal static class Program
{
    [STAThread]
    private static async Task<int> Main()
    {
        Console.Title = "TestPilot Windows Agent 1.2";
        Console.WriteLine("TestPilot AI · Windows Forms Runner MVP");
        Console.WriteLine("IMPORTANT: keep this VM user session logged in and unlocked while tests run.\n");
        try
        {
            var settings = AgentSettings.FromEnvironment();
            using var cts = new CancellationTokenSource();
            Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };
            await new RunnerLoop(settings).RunAsync(cts.Token);
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex);
            return 1;
        }
    }
}
