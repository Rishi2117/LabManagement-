using Microsoft.EntityFrameworkCore;
using server.Models;
using server.Services;
namespace server.Data;

public class AppDb : DbContext {
  private readonly TenantContext _tenant;

  public AppDb(DbContextOptions<AppDb> o, TenantContext tenant) : base(o) {
    _tenant = tenant;
  }

  public DbSet<Lab> Labs => Set<Lab>();
  public DbSet<Order> Orders => Set<Order>();
  public DbSet<Patient> Patients => Set<Patient>();
  public DbSet<Test> Tests => Set<Test>();
  public DbSet<ReferralDoctor> ReferralDoctors => Set<ReferralDoctor>();
  public DbSet<TestParameter> TestParameters => Set<TestParameter>();
  public DbSet<User> Users => Set<User>();

  protected override void OnModelCreating(ModelBuilder b) {
    base.OnModelCreating(b);

    // Lab code is the login identifier and must be unique across the system.
    b.Entity<Lab>().HasIndex(l => l.Code).IsUnique();

    // Per-lab natural keys (same phone/username/id can exist in different labs).
    b.Entity<Patient>().HasKey(p => new { p.LabId, p.Phone });
    b.Entity<User>().HasKey(u => new { u.LabId, u.Username });
    b.Entity<Order>().HasKey(o => new { o.LabId, o.Id });
    b.Entity<Test>().HasKey(t => new { t.LabId, t.Id });
    // ReferralDoctor and TestParameter keep their auto-increment int Id.

    // Token lookup (used by middleware to resolve the current lab).
    b.Entity<User>().HasIndex(u => u.Token);

    // Global tenant filters: every query is automatically scoped to the
    // current lab, so cross-lab data can never leak.
    b.Entity<Patient>().HasQueryFilter(e => e.LabId == _tenant.LabId);
    b.Entity<Order>().HasQueryFilter(e => e.LabId == _tenant.LabId);
    b.Entity<Test>().HasQueryFilter(e => e.LabId == _tenant.LabId);
    b.Entity<ReferralDoctor>().HasQueryFilter(e => e.LabId == _tenant.LabId);
    b.Entity<TestParameter>().HasQueryFilter(e => e.LabId == _tenant.LabId);
    b.Entity<User>().HasQueryFilter(e => e.LabId == _tenant.LabId);
  }

  public override int SaveChanges() { Stamp(); return base.SaveChanges(); }
  public override Task<int> SaveChangesAsync(CancellationToken ct = default) {
    Stamp();
    return base.SaveChangesAsync(ct);
  }

  // Auto-stamp LabId on new tenant rows from the current request's lab.
  private void Stamp() {
    if (_tenant.LabId is not int lab) return;
    foreach (var e in ChangeTracker.Entries<ITenant>())
      if (e.State == EntityState.Added && e.Entity.LabId == 0)
        e.Entity.LabId = lab;
  }
}
