namespace server.Models;

// Marker for entities that belong to a single lab (tenant).
public interface ITenant {
  int LabId { get; set; }
}
