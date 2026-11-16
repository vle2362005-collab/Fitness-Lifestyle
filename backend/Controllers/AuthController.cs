using FitnessLifestyle.API.Data;
using FitnessLifestyle.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace FitnessLifestyle.API.Controllers;

public class RegisterDto
{
    public string Username { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Password { get; set; } = string.Empty;
    public string? FullName { get; set; }
}

public class LoginDto
{
    // Cho phép Web/App đăng nhập bằng username hoặc email để tránh lệch DTO giữa các client.
    public string? Username { get; set; }
    public string? Email { get; set; }
    public string Password { get; set; } = string.Empty;
}

[Route("api/[controller]")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthController(ApplicationDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Mật khẩu không được để trống." });

        var username = NormalizeUsername(request.Username, request.Email, request.FullName);
        if (string.IsNullOrWhiteSpace(username))
            return BadRequest(new { message = "Tên đăng nhập không được để trống." });

        var email = string.IsNullOrWhiteSpace(request.Email)
            ? $"{username}@fitness.local"
            : request.Email.Trim().ToLowerInvariant();

        var existed = await _context.Users.AnyAsync(u => u.Username == username || u.Email == email);
        if (existed) return BadRequest(new { message = "Tên đăng nhập hoặc email đã tồn tại." });

        var user = new User
        {
            Username = username,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = UserRole.User,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Đăng ký thành công!",
            userId = user.Id,
            username = user.Username,
            email = user.Email,
            role = user.Role.ToString()
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto request)
    {
        var identifier = (request.Username ?? request.Email ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Tài khoản/email và mật khẩu không được để trống." });

        var user = await _context.Users.FirstOrDefaultAsync(u =>
            u.Username.ToLower() == identifier || u.Email.ToLower() == identifier);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return BadRequest(new { message = "Tài khoản hoặc mật khẩu không chính xác." });

        var token = CreateToken(user);
        var roleName = user.Role == UserRole.Admin ? "Admin" : "User";

        return Ok(new
        {
            token,
            userId = user.Id,
            username = user.Username,
            email = user.Email,
            role = roleName
        });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var user = await _context.Users
            .AsNoTracking()
            .Include(u => u.MedicalProfile)
            .Where(u => u.Id == userId.Value)
            .Select(u => new
            {
                u.Id,
                u.Username,
                u.Email,
                Role = u.Role.ToString(),
                u.CreatedAt,
                u.MedicalProfile
            })
            .FirstOrDefaultAsync();

        return user == null ? Unauthorized(new { message = "Không tìm thấy tài khoản." }) : Ok(user);
    }

    private string CreateToken(User user)
    {
        var roleName = user.Role == UserRole.Admin ? "Admin" : "User";

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, roleName),
            new("userId", user.Id.ToString())
        };

        var jwtKey = _configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("Missing Jwt:Key configuration.");
        var jwtIssuer = _configuration["Jwt:Issuer"]
            ?? throw new InvalidOperationException("Missing Jwt:Issuer configuration.");
        var jwtAudience = _configuration["Jwt:Audience"]
            ?? throw new InvalidOperationException("Missing Jwt:Audience configuration.");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256Signature);

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string NormalizeUsername(string? username, string? email, string? fullName)
    {
        var raw = !string.IsNullOrWhiteSpace(username)
            ? username
            : !string.IsNullOrWhiteSpace(email)
                ? email.Split('@')[0]
                : fullName;

        return string.IsNullOrWhiteSpace(raw)
            ? string.Empty
            : raw.Trim().Replace(" ", "_");
    }

    private int? GetCurrentUserId()
    {
        var userIdString = User.FindFirst("userId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdString, out var userId) ? userId : null;
    }
}
