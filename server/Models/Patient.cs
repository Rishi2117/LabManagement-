namespace server.Models;

public class Patient : ITenant {
  public int LabId { get; set; }
  public string Phone { get; set; } = "";
  public string Name { get; set; } = "";
  public string Age { get; set; } = "";
  public string Sex { get; set; } = "";
}
