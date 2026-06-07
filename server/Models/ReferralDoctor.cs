using System.ComponentModel.DataAnnotations;
namespace server.Models;

public class ReferralDoctor : ITenant {
  public int LabId { get; set; }
  [Key]
  public int Id { get; set; }          // auto-increment
  public string Name { get; set; } = "";
  public string? Specialty { get; set; }
  public string? Phone { get; set; }
}
