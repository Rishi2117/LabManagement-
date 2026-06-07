namespace server.Models;

public class Test : ITenant {
  public int LabId { get; set; }
  public string Id { get; set; } = "";
  public string Name { get; set; } = "";
  public int Price { get; set; }
  public string Tat { get; set; } = "";
  public string Category { get; set; } = "";
}
