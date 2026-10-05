namespace SampleWinFormsTarget;

public sealed class MainForm : Form
{
    private readonly TextBox _code = new() { Name = "CustomerCodeTextBox", AccessibleName = "Customer Code", Width = 260 };
    private readonly TextBox _name = new() { Name = "CustomerNameTextBox", AccessibleName = "Customer Name", Width = 260 };
    private readonly Label _result = new() { Name = "GeneratedCustomerNo", AccessibleName = "Generated Customer Number", AutoSize = true, Text = "No customer created yet" };
    private readonly Label _message = new() { Name = "ValidationMessage", AccessibleName = "Validation Message", AutoSize = true };
    private readonly ListBox _list = new() { Name = "CustomerList", AccessibleName = "Customer List", Width = 360, Height = 140 };
    private readonly HashSet<string> _codes = new(StringComparer.OrdinalIgnoreCase);
    private int _sequence = 1000;

    public MainForm()
    {
        Text = "TestPilot Sample Customer Management";
        Name = "CustomerManagementWindow";
        Width = 520; Height = 480; StartPosition = FormStartPosition.CenterScreen;
        var create = new Button { Name = "CreateCustomerButton", AccessibleName = "Create Customer", Text = "Create Customer", AutoSize = true };
        create.Click += (_, _) => CreateCustomer();
        var layout = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, Padding = new Padding(24), WrapContents = false, AutoScroll = true };
        layout.Controls.Add(new Label { Text = "Customer Code", AutoSize = true }); layout.Controls.Add(_code);
        layout.Controls.Add(new Label { Text = "Customer Name", AutoSize = true }); layout.Controls.Add(_name);
        layout.Controls.Add(create); layout.Controls.Add(_message); layout.Controls.Add(_result);
        layout.Controls.Add(new Label { Text = "Customer List", AutoSize = true }); layout.Controls.Add(_list);
        Controls.Add(layout);
    }

    private void CreateCustomer()
    {
        _message.Text = "";
        var code = _code.Text.Trim(); var name = _name.Text.Trim();
        if (string.IsNullOrWhiteSpace(code)) { _message.Text = "Customer Code is required."; return; }
        if (_codes.Contains(code)) { _message.Text = "Customer Code already exists."; return; }
        _codes.Add(code); var no = $"CUS{++_sequence:000000}";
        _result.Text = no; _list.Items.Add($"{no} | {code} | {name}"); _message.Text = "Customer created successfully.";
    }
}
