namespace server.Models;
public class Order : ITenant {
  public int LabId { get; set; }
  public string Id { get; set; } = "";
  public string Phone { get; set; } = "";        // links to Patient
  public string TestsJson { get; set; } = "";
  public int Total { get; set; }
  public string PayMode { get; set; } = "";
  public string Status { get; set; } = "";
  public string? ResultsJson { get; set; }
  public DateTime Created { get; set; }
  public string? ReferredBy { get; set; }
}
