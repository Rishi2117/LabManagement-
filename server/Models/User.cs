namespace server.Models;

public class User : ITenant {
  public int LabId { get; set; }
  public string Username { get; set; } = "";
  public string Password { get; set; } = "";   // plain (as chosen) - hash later
  public string? FullName { get; set; }
  public string? Token { get; set; }           // session token issued at login
}
