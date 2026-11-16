using FitnessLifestyle.API.Data;
using FitnessLifestyle.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FitnessLifestyle.API.Controllers;

public class UpdateUserRoleDto
{
    public UserRole Role { get; set; }
}

[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AdminController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetSystemStats()
    {
        var totalUsers = await _context.Users.CountAsync();
        var totalExercises = await _context.Exercises.CountAsync();
        var totalWorkoutSessions = await _context.WorkoutSessions.CountAsync();
        var totalAnalyses = await _context.WorkoutAnalyses.CountAsync();
        var totalNutritionLogs = await _context.NutritionLogs.CountAsync();
        var totalCaloriesBurned = await _context.WorkoutSessions.SumAsync(w => (double?)w.CaloriesBurned) ?? 0;

        return Ok(new
        {
            totalUsers,
            totalExercises,
            totalWorkoutSessions,
            totalAnalyses,
            totalNutritionLogs,
            totalCaloriesBurned = Math.Round(totalCaloriesBurned, 1)
        });
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetAllUsers([FromQuery] string? search)
    {
        var query = _context.Users.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(u => u.Username.ToLower().Contains(keyword) || u.Email.ToLower().Contains(keyword));
        }

        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new
            {
                id = u.Id,
                username = u.Username,
                email = u.Email,
                role = u.Role.ToString(),
                createdAt = u.CreatedAt
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpPut("users/{id:int}/role")]
    public async Task<IActionResult> UpdateUserRole(int id, [FromBody] UpdateUserRoleDto request)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == id) return BadRequest(new { message = "Không thể tự đổi quyền của tài khoản hiện tại." });

        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound(new { message = "Không tìm thấy tài khoản." });

        user.Role = request.Role;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Đã cập nhật quyền tài khoản.", userId = user.Id, role = user.Role.ToString() });
    }

    [HttpDelete("users/{id:int}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound(new { message = "Không tìm thấy tài khoản." });

        var currentUserId = GetCurrentUserId();
        if (currentUserId == id) return BadRequest(new { message = "Không thể tự xóa tài khoản của mình." });

        await using var transaction = await _context.Database.BeginTransactionAsync();
        await _context.CommunityLikes.Where(x => x.UserId == id).ExecuteDeleteAsync();
        await _context.CommunityComments.Where(x => x.AuthorId == id).ExecuteDeleteAsync();

        var analyses = await _context.WorkoutAnalyses.Where(a => a.UserId == id).ToListAsync();
        var workouts = await _context.WorkoutSessions.Where(w => w.UserId == id).ToListAsync();
        var nutritionLogs = await _context.NutritionLogs.Where(n => n.UserId == id).ToListAsync();
        var userBadges = await _context.UserBadges.Where(ub => ub.UserId == id).ToListAsync();
        var profile = await _context.MedicalProfiles.FirstOrDefaultAsync(p => p.UserId == id);

        _context.WorkoutAnalyses.RemoveRange(analyses);
        _context.WorkoutSessions.RemoveRange(workouts);
        _context.NutritionLogs.RemoveRange(nutritionLogs);
        _context.UserBadges.RemoveRange(userBadges);
        if (profile != null) _context.MedicalProfiles.Remove(profile);
        _context.Users.Remove(user);

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { message = "Đã xóa tài khoản thành công!" });
    }

    private int? GetCurrentUserId()
    {
        var userIdString = User.FindFirst("userId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdString, out var userId) ? userId : null;
    }
}
