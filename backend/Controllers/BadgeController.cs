using FitnessLifestyle.API.Data;
using FitnessLifestyle.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FitnessLifestyle.API.Controllers;

public class BadgeDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? IconUrl { get; set; }
}

public class AwardBadgeDto
{
    public int UserId { get; set; }
    public int BadgeId { get; set; }
}

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class BadgeController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public BadgeController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var badges = await _context.Badges.AsNoTracking().OrderBy(b => b.Id).ToListAsync();
        return Ok(badges);
    }

    [HttpGet("mine")]
    public async Task<IActionResult> GetMyBadges()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var badges = await _context.UserBadges
            .AsNoTracking()
            .Include(ub => ub.Badge)
            .Where(ub => ub.UserId == userId.Value)
            .OrderByDescending(ub => ub.EarnedAt)
            .Select(ub => new
            {
                ub.Id,
                ub.BadgeId,
                ub.EarnedAt,
                ub.Badge
            })
            .ToListAsync();

        return Ok(badges);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] BadgeDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Tên huy hiệu không được để trống." });

        var badge = new Badge
        {
            Name = request.Name.Trim(),
            Description = NormalizeNullable(request.Description),
            IconUrl = NormalizeNullable(request.IconUrl)
        };

        _context.Badges.Add(badge);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Thêm huy hiệu thành công.", badge });
    }

    [HttpPost("award")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Award([FromBody] AwardBadgeDto request)
    {
        var userExists = await _context.Users.AnyAsync(u => u.Id == request.UserId);
        if (!userExists) return NotFound(new { message = "Không tìm thấy người dùng." });

        var badgeExists = await _context.Badges.AnyAsync(b => b.Id == request.BadgeId);
        if (!badgeExists) return NotFound(new { message = "Không tìm thấy huy hiệu." });

        var alreadyAwarded = await _context.UserBadges.AnyAsync(ub => ub.UserId == request.UserId && ub.BadgeId == request.BadgeId);
        if (alreadyAwarded) return Ok(new { message = "Người dùng đã có huy hiệu này." });

        var userBadge = new UserBadge
        {
            UserId = request.UserId,
            BadgeId = request.BadgeId,
            EarnedAt = DateTime.UtcNow
        };

        _context.UserBadges.Add(userBadge);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Đã trao huy hiệu.", userBadgeId = userBadge.Id });
    }

    private int? GetCurrentUserId()
    {
        var userIdString = User.FindFirst("userId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdString, out var userId) ? userId : null;
    }

    private static string? NormalizeNullable(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
