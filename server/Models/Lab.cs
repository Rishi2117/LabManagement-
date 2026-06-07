namespace server.Models;

public class Lab {
  public int Id { get; set; }
  public string Code { get; set; } = "";    // login code, e.g. "LABA" (unique)
  public string Name { get; set; } = "";
  public string? Address { get; set; }      // for report letterhead
  public string? Phone { get; set; }
  public string? Email { get; set; }
}
