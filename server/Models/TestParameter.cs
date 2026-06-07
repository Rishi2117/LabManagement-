using System.ComponentModel.DataAnnotations;
namespace server.Models;

public class TestParameter : ITenant {
  public int LabId { get; set; }
  [Key]
  public int Id { get; set; }
  public string TestId { get; set; } = "";      // links to Test (e.g. "glucose")
  public string Name { get; set; } = "";
  public string? Method { get; set; }
  public string Unit { get; set; } = "";
  public double RefLow { get; set; }
  public double RefHigh { get; set; }
  public int SortOrder { get; set; }
}
