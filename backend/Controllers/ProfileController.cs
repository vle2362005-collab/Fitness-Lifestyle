using FitnessLifestyle.API.Data;
using FitnessLifestyle.API.Models;
using FitnessLifestyle.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FitnessLifestyle.API.Controllers;

public class UpsertProfileDto
{
    public double Height { get; set; }
    public double Weight { get; set; }
    public int Age { get; set; }
    public Gender Gender { get; set; }
    public ActivityLevel ActivityLevel { get; set; }
    public FitnessGoal Goal { get; set; }
}

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IFitnessService _fitnessService;

    public ProfileController(ApplicationDbContext context, IFitnessService fitnessService)
    {
        _context = context;
        _fitnessService = fitnessService;
    }

    [HttpGet]
    public async Task<ActionResult<MedicalProfile>> GetMyProfile()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var profile = await _context.MedicalProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId.Value);
        return profile == null ? NotFound(new { message = "Bạn chưa cập nhật hồ sơ sức khỏe." }) : Ok(profile);
    }

    [HttpGet("{userId:int}")]
    public async Task<IActionResult> GetProfile(int userId)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == null) return Unauthorized(new { message = "Token không hợp lệ." });
        if (currentUserId.Value != userId && !User.IsInRole("Admin"))
            return Forbid();

        var profile = await _context.MedicalProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId);
        return profile == null ? NotFound(new { message = "Không tìm thấy hồ sơ sức khỏe." }) : Ok(profile);
    }

    [HttpPost]
    [HttpPut]
    public async Task<IActionResult> UpsertMyProfile([FromBody] UpsertProfileDto request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var validation = ValidateProfile(request);
        if (validation != null) return validation;

        var profile = await _context.MedicalProfiles.FindAsync(userId.Value);
        if (profile == null)
        {
            profile = new MedicalProfile { UserId = userId.Value };
            _context.MedicalProfiles.Add(profile);
        }

        profile.Height = request.Height;
        profile.Weight = request.Weight;
        profile.Age = request.Age;
        profile.Gender = request.Gender;
        profile.ActivityLevel = request.ActivityLevel;
        profile.Goal = request.Goal;

        _fitnessService.CalculateFitnessMetrics(profile);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Cập nhật hồ sơ sức khỏe thành công.", profile });
    }

    // Giữ tương thích endpoint cũ nhưng không cho user sửa hồ sơ người khác.
    [HttpPost("{userId:int}")]
    [HttpPut("{userId:int}")]
    public async Task<IActionResult> UpsertProfileById(int userId, [FromBody] UpsertProfileDto request)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == null) return Unauthorized(new { message = "Token không hợp lệ." });
        if (currentUserId.Value != userId && !User.IsInRole("Admin"))
            return Forbid();

        var validation = ValidateProfile(request);
        if (validation != null) return validation;

        var profile = await _context.MedicalProfiles.FindAsync(userId);
        if (profile == null)
        {
            profile = new MedicalProfile { UserId = userId };
            _context.MedicalProfiles.Add(profile);
        }

        profile.Height = request.Height;
        profile.Weight = request.Weight;
        profile.Age = request.Age;
        profile.Gender = request.Gender;
        profile.ActivityLevel = request.ActivityLevel;
        profile.Goal = request.Goal;

        _fitnessService.CalculateFitnessMetrics(profile);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Cập nhật hồ sơ sức khỏe thành công.", profile });
    }

    private BadRequestObjectResult? ValidateProfile(UpsertProfileDto request)
    {
        if (request.Height is < 50 or > 250)
            return BadRequest(new { message = "Chiều cao phải trong khoảng 50-250 cm." });
        if (request.Weight is < 30 or > 300)
            return BadRequest(new { message = "Cân nặng phải trong khoảng 30-300 kg." });
        if (request.Age is < 10 or > 100)
            return BadRequest(new { message = "Tuổi phải trong khoảng 10-100." });
        return null;
    }

    private int? GetCurrentUserId()
    {
        var userIdString = User.FindFirst("userId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdString, out var userId) ? userId : null;
    }
}
