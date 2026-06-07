namespace server.Services;

// Per-request holder for the current lab id. Set by middleware from the
// bearer token, read by AppDb's global query filters.
public class TenantContext {
  public int? LabId { get; set; }
}
