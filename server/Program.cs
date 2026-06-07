using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Services;

var builder = WebApplication.CreateBuilder(args);

// In the cloud (Render etc.) bind to the injected PORT. Locally this is unset,
// so the normal launchSettings port is used and local dev is unaffected.
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

builder.Services.AddScoped<TenantContext>();
builder.Services.AddDbContext<AppDb>(o =>
  o.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddCors(c => c.AddDefaultPolicy(p =>
  p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddOpenApi();

var app = builder.Build();

// Apply any pending EF Core migrations on startup so the database schema is
// always up to date (handy on free single-instance hosts like Render).
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDb>();
    db.Database.Migrate();
}

app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseHttpsRedirection();   // dev only; in the cloud TLS is handled by the host's proxy
}

// --- Resolve the current lab from the bearer token on every request ---
app.Use(async (ctx, next) => {
    var token = ctx.Request.Headers.Authorization.ToString().Replace("Bearer ", "").Trim();
    if (!string.IsNullOrEmpty(token)) {
        var db = ctx.RequestServices.GetRequiredService<AppDb>();
        var tenant = ctx.RequestServices.GetRequiredService<TenantContext>();
        var u = await db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Token == token);
        if (u != null) tenant.LabId = u.LabId;
    }
    await next();
});

// --- Auth: create a brand-new lab + its first admin (self-serve) ---
app.MapPost("/register-lab", async (AppDb db, NewLabDto dto) => {
    var code = dto.LabCode.Trim().ToUpper();
    if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(dto.Username))
        return Results.BadRequest(new { error = "Lab code and username are required" });
    if (await db.Labs.AnyAsync(l => l.Code == code))
        return Results.Conflict(new { error = "Lab code already in use" });

    var lab = new server.Models.Lab {
        Code = code, Name = dto.LabName.Trim(),
        Address = dto.Address, Phone = dto.LabPhone, Email = dto.Email
    };
    db.Labs.Add(lab);
    await db.SaveChangesAsync();   // assigns lab.Id

    var token = Guid.NewGuid().ToString("N");
    db.Users.Add(new server.Models.User {
        LabId = lab.Id, Username = dto.Username.Trim(),
        Password = dto.Password, FullName = dto.FullName, Token = token
    });
    await db.SaveChangesAsync();

    return Results.Ok(new {
        token, labId = lab.Id, labCode = lab.Code, labName = lab.Name,
        username = dto.Username.Trim(), fullName = dto.FullName
    });
});

// --- Auth: login with lab code + username + password ---
app.MapPost("/login", async (AppDb db, LoginDto dto) => {
    var code = dto.LabCode.Trim().ToUpper();
    var lab = await db.Labs.FirstOrDefaultAsync(l => l.Code == code);
    if (lab is null) return Results.Unauthorized();

    var u = await db.Users.IgnoreQueryFilters()
        .FirstOrDefaultAsync(x => x.LabId == lab.Id && x.Username == dto.Username.Trim());
    if (u is null || u.Password != dto.Password) return Results.Unauthorized();

    u.Token = Guid.NewGuid().ToString("N");
    await db.SaveChangesAsync();

    return Results.Ok(new {
        token = u.Token, labId = lab.Id, labCode = lab.Code, labName = lab.Name,
        username = u.Username, fullName = u.FullName
    });
});

// --- Add staff to the current lab (must be logged in) ---
app.MapPost("/users", async (AppDb db, TenantContext tenant, server.Models.User u) => {
    if (tenant.LabId is not int lab) return Results.Unauthorized();
    if (await db.Users.AnyAsync(x => x.Username == u.Username.Trim()))   // filtered to current lab
        return Results.Conflict(new { error = "Username already exists" });
    db.Users.Add(new server.Models.User {
        LabId = lab, Username = u.Username.Trim(), Password = u.Password, FullName = u.FullName
    });
    await db.SaveChangesAsync();
    return Results.Ok(new { u.Username, u.FullName });
});

// --- Current lab (for report letterhead) ---
app.MapGet("/lab", async (AppDb db, TenantContext tenant) => {
    if (tenant.LabId is not int lab) return Results.Unauthorized();
    var l = await db.Labs.FindAsync(lab);
    return l is null ? Results.NotFound() : Results.Ok(l);
});

// --- Patients ---
app.MapGet("/patients", async (AppDb db) =>
    await db.Patients.ToListAsync());

app.MapGet("/patients/{phone}", async (AppDb db, string phone) => {
    var p = await db.Patients.FirstOrDefaultAsync(x => x.Phone == phone);
    return p is null ? Results.NotFound() : Results.Ok(p);
});

// --- Orders ---
app.MapGet("/orders", async (AppDb db) =>
    await db.Orders.OrderByDescending(o => o.Created).ToListAsync());

app.MapPost("/orders", async (AppDb db, OrderDto dto) => {
    var existing = await db.Patients.FirstOrDefaultAsync(p => p.Phone == dto.Phone);
    if (existing is null) {
        db.Patients.Add(new server.Models.Patient {
            Phone = dto.Phone, Name = dto.Name, Age = dto.Age, Sex = dto.Sex
        });
    } else {
        existing.Name = dto.Name; existing.Age = dto.Age; existing.Sex = dto.Sex;
    }
    var order = new server.Models.Order {
        Id = dto.Id, Phone = dto.Phone, ReferredBy = dto.ReferredBy,
        TestsJson = dto.TestsJson, Total = dto.Total, PayMode = dto.PayMode,
        Status = "Registered", Created = DateTime.UtcNow,
    };
    db.Orders.Add(order);
    await db.SaveChangesAsync();
    return Results.Ok(order);
});

app.MapPut("/orders/{id}", async (AppDb db, string id, server.Models.Order u) => {
    var o = await db.Orders.FirstOrDefaultAsync(x => x.Id == id);
    if (o is null) return Results.NotFound();
    o.Status = u.Status;
    o.ResultsJson = u.ResultsJson;
    await db.SaveChangesAsync();
    return Results.Ok(o);
});

// --- Tests ---
app.MapGet("/tests", async (AppDb db) =>
    await db.Tests.OrderBy(t => t.Name).ToListAsync());

app.MapPost("/tests", async (AppDb db, server.Models.Test t) => {
    db.Tests.Add(t);
    await db.SaveChangesAsync();
    return Results.Ok(t);
});

app.MapPut("/tests/{id}", async (AppDb db, string id, server.Models.Test u) => {
    var t = await db.Tests.FirstOrDefaultAsync(x => x.Id == id);
    if (t is null) return Results.NotFound();
    t.Name = u.Name; t.Price = u.Price; t.Tat = u.Tat; t.Category = u.Category;
    await db.SaveChangesAsync();
    return Results.Ok(t);
});

app.MapDelete("/tests/{id}", async (AppDb db, string id) => {
    var t = await db.Tests.FirstOrDefaultAsync(x => x.Id == id);
    if (t is null) return Results.NotFound();
    db.Tests.Remove(t);
    await db.SaveChangesAsync();
    return Results.Ok();
});

// --- Referral Doctors ---
app.MapGet("/doctors", async (AppDb db) =>
    await db.ReferralDoctors.OrderBy(d => d.Name).ToListAsync());

app.MapPost("/doctors", async (AppDb db, server.Models.ReferralDoctor d) => {
    db.ReferralDoctors.Add(d);
    await db.SaveChangesAsync();
    return Results.Ok(d);
});

app.MapDelete("/doctors/{id}", async (AppDb db, int id) => {
    var d = await db.ReferralDoctors.FirstOrDefaultAsync(x => x.Id == id);
    if (d is null) return Results.NotFound();
    db.ReferralDoctors.Remove(d);
    await db.SaveChangesAsync();
    return Results.Ok();
});

// --- Test Parameters ---
app.MapGet("/parameters/{testId}", async (AppDb db, string testId) =>
    await db.TestParameters.Where(p => p.TestId == testId).OrderBy(p => p.SortOrder).ToListAsync());

app.MapGet("/parameters", async (AppDb db) =>
    await db.TestParameters.OrderBy(p => p.SortOrder).ToListAsync());

app.MapPost("/parameters", async (AppDb db, server.Models.TestParameter p) => {
    db.TestParameters.Add(p); await db.SaveChangesAsync(); return Results.Ok(p);
});

app.MapDelete("/parameters/{id}", async (AppDb db, int id) => {
    var p = await db.TestParameters.FirstOrDefaultAsync(x => x.Id == id);
    if (p is null) return Results.NotFound();
    db.TestParameters.Remove(p); await db.SaveChangesAsync(); return Results.Ok();
});

app.Run();

record OrderDto(
    string Id, string Phone, string Name, string Age, string Sex,
    string? ReferredBy, string TestsJson, int Total, string PayMode);

record NewLabDto(
    string LabName, string LabCode, string Username, string Password,
    string? FullName, string? Address, string? LabPhone, string? Email);

record LoginDto(string LabCode, string Username, string Password);
