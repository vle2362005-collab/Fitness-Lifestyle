using FitnessLifestyle.Coach;
using FitnessLifestyle.API.Data;
using FitnessLifestyle.API.Models;
using FitnessLifestyle.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 250_000_000;
});

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 250_000_000;
});

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: true));
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "FitnessLifestyle API",
        Version = "v1",
        Description = "API cho hệ thống Web & App Fitness and Lifestyle"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Nhập token theo định dạng: Bearer {token}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddScoped<IFitnessService, FitnessService>();
builder.Services.AddSingleton<CoachSessions>();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"),
        sql => sql.UseCompatibilityLevel(builder.Configuration.GetValue("Database:CompatibilityLevel", 120))));

// Cấu hình Cors:Origins cho các địa chỉ Web được phép gọi API.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowWebAndMobile", policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
            ?? ["http://localhost:3000", "http://127.0.0.1:3000"];
        policy.WithOrigins(origins).AllowAnyMethod().AllowAnyHeader();
    });
});

var jwtKey = builder.Configuration["Jwt:Key"];
var jwtIssuer = builder.Configuration["Jwt:Issuer"];
var jwtAudience = builder.Configuration["Jwt:Audience"];

if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32 || string.IsNullOrWhiteSpace(jwtIssuer) || string.IsNullOrWhiteSpace(jwtAudience))
    throw new InvalidOperationException("Cần cấu hình Jwt__Key tối thiểu 32 byte, Jwt__Issuer và Jwt__Audience.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

Directory.CreateDirectory(Path.Combine(app.Environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads"));
await SeedReferenceDataAsync(app.Services, app.Environment);
await SeedDefaultAdminAsync(app.Services, app.Configuration, app.Environment);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "FitnessLifestyle API v1");
    });
}

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync("{\"error\":\"Đã xảy ra lỗi máy chủ.\"}");
    });
});

if (!app.Environment.IsDevelopment() || !app.Configuration.GetValue<bool>("LocalDemo:AllowHttp"))
    app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseCors("AllowWebAndMobile");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok", coach = PoseReplay.EngineVersion }));
app.MapGet("/ready", async (ApplicationDbContext db, CancellationToken ct) =>
{
    try
    {
        await db.CommunityPosts.AsNoTracking().Select(p => p.Id).Take(1).ToListAsync(ct);
        return Results.Ok(new { status = "ready" });
    }
    catch (Exception) when (!ct.IsCancellationRequested)
    {
        return Results.StatusCode(503);
    }
});
app.Run();

static async Task SeedDefaultAdminAsync(IServiceProvider services, IConfiguration configuration, IWebHostEnvironment environment)
{
    var enabled = configuration.GetValue<bool>("DefaultAdmin:Enabled");
    if (!enabled) return;

    var username = configuration["DefaultAdmin:Username"];
    var email = configuration["DefaultAdmin:Email"];
    var password = configuration["DefaultAdmin:Password"];

    if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        return;

    using var scope = services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    try
    {
        var exists = await db.Users.AnyAsync(u => u.Username == username || u.Email == email);
        if (exists) return;

        db.Users.Add(new User
        {
            Username = username.Trim(),
            Email = email.Trim().ToLowerInvariant(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = UserRole.Admin,
            CreatedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync();
    }
    catch when (environment.IsDevelopment())
    {
        // Nếu database chưa migrate, không chặn app khởi động; chạy dotnet ef database update trước rồi khởi động lại.
    }
}


static async Task SeedReferenceDataAsync(IServiceProvider services, IWebHostEnvironment environment)
{
    using var scope = services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    try
    {
        if (!await db.Exercises.AnyAsync())
        {
            db.Exercises.AddRange(
                new Exercise
                {
                    Name = "Squat",
                    Category = "Legs",
                    Description = "Bài tập đứng lên ngồi xuống cho cơ đùi và mông.",
                    MetValue = 5.0,
                    CaloriesPerMinute = 8,
                    ImageUrl = string.Empty,
                    VideoUrl = "squat_tutorial.mp4",
                    AiConfig = "{\"mode\":\"angle\",\"metricName\":\"Góc đầu gối\",\"points\":[\"left_hip\",\"left_knee\",\"left_ankle\"],\"minScore\":0.4,\"downRule\":{\"operator\":\"<\",\"value\":100,\"feedback\":\"Đùi đã song song! Đứng lên!\"},\"upRule\":{\"operator\":\">\",\"value\":160},\"missingFeedback\":\"Vui lòng đứng xa camera để AI thấy hông, gối và cổ chân!\",\"warningFeedback\":\"Ngồi sâu xuống nữa!\"}"
                },
                new Exercise
                {
                    Name = "Push-up",
                    Category = "Chest",
                    Description = "Bài tập hít đất cho cơ ngực và tay sau.",
                    MetValue = 8.0,
                    CaloriesPerMinute = 9,
                    ImageUrl = string.Empty,
                    VideoUrl = "pushup_tutorial.mp4",
                    AiConfig = "{\"mode\":\"angle\",\"metricName\":\"Góc khuỷu tay\",\"points\":[\"left_shoulder\",\"left_elbow\",\"left_wrist\"],\"minScore\":0.4,\"downRule\":{\"operator\":\"<\",\"value\":90,\"feedback\":\"Góc đẹp! Đẩy mạnh lên!\"},\"upRule\":{\"operator\":\">\",\"value\":150},\"missingFeedback\":\"Vui lòng quay ngang người để AI thấy cánh tay!\",\"warningFeedback\":\"Hạ khuỷu tay xuống nữa!\"}"
                },
                new Exercise
                {
                    Name = "Plank",
                    Category = "Abs",
                    Description = "Bài tập giữ người thẳng cho cơ lõi (core).",
                    MetValue = 3.0,
                    CaloriesPerMinute = 4,
                    ImageUrl = string.Empty,
                    VideoUrl = "plank_tutorial.mp4",
                    AiConfig = "{\"mode\":\"vertical\",\"point\":\"nose\",\"minScore\":0.5,\"threshold\":40,\"missingFeedback\":\"AI chưa thấy rõ khuôn mặt!\",\"downFeedback\":\"Tốt! Tiếp tục giữ nhịp.\",\"upFeedback\":\"Hoàn thành một nhịp!\"}"
                }
            );
        }

        if (!await db.Foods.AnyAsync())
        {
            db.Foods.AddRange(
                new Food { Name = "Ức gà (100g)", Calories = 165, Protein = 31, Carbs = 0, Fat = 3.6 },
                new Food { Name = "Gạo lứt (100g)", Calories = 110, Protein = 2.6, Carbs = 23, Fat = 0.9 },
                new Food { Name = "Trứng gà (1 quả)", Calories = 78, Protein = 6, Carbs = 0.6, Fat = 5 },
                new Food { Name = "Chuối (1 quả)", Calories = 105, Protein = 1.3, Carbs = 27, Fat = 0.3 },
                new Food { Name = "Cá hồi (100g)", Calories = 208, Protein = 20, Carbs = 0, Fat = 13 }
            );
        }

        if (!await db.Badges.AnyAsync())
        {
            db.Badges.AddRange(
                new Badge { Name = "Starter", Description = "Hoàn thành buổi tập đầu tiên.", IconUrl = "🏁" },
                new Badge { Name = "Consistency", Description = "Duy trì luyện tập đều đặn.", IconUrl = "🔥" },
                new Badge { Name = "AI Analyzer", Description = "Lưu kết quả phân tích bài tập bằng AI.", IconUrl = "🤖" }
            );
        }

        await db.SaveChangesAsync();
    }
    catch when (environment.IsDevelopment())
    {
        // Nếu database chưa migrate, không chặn app khởi động; chạy dotnet ef database update trước rồi khởi động lại.
    }
}
