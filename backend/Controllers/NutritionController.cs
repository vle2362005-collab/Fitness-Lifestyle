using FitnessLifestyle.API.Data;
using FitnessLifestyle.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FitnessLifestyle.API.Controllers;

public class LogNutritionDto
{
    public int FoodId { get; set; }
    public double Quantity { get; set; } = 1;
    public MealType MealType { get; set; } = MealType.Snack;
    public DateTime? Date { get; set; }
}

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class NutritionController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public NutritionController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("foods")]
    [AllowAnonymous]
    public async Task<IActionResult> GetFoods([FromQuery] string? search)
    {
        var query = _context.Foods.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(f => f.Name.ToLower().Contains(keyword));
        }

        var foods = await query.OrderBy(f => f.Name).ToListAsync();
        return Ok(foods);
    }

    [HttpGet]
    public async Task<IActionResult> GetMyNutritionLogs([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var query = _context.NutritionLogs
            .AsNoTracking()
            .Include(n => n.Food)
            .Where(n => n.UserId == userId.Value);

        if (from.HasValue) query = query.Where(n => n.Date >= from.Value.Date);
        if (to.HasValue) query = query.Where(n => n.Date < to.Value.Date.AddDays(1));

        var logs = await query
            .OrderByDescending(n => n.Date)
            .ThenByDescending(n => n.Id)
            .ToListAsync();

        return Ok(logs.Select(ToLogResponse));
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] DateTime? date)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var selectedDate = (date ?? DateTime.UtcNow).Date;
        var nextDate = selectedDate.AddDays(1);

        var logs = await _context.NutritionLogs
            .AsNoTracking()
            .Include(n => n.Food)
            .Where(n => n.UserId == userId.Value && n.Date >= selectedDate && n.Date < nextDate)
            .ToListAsync();

        var totals = logs.Aggregate(new NutritionTotals(), (acc, log) =>
        {
            var multiplier = Math.Max(0, log.Quantity);
            acc.Calories += (log.Food?.Calories ?? 0) * multiplier;
            acc.Protein += (log.Food?.Protein ?? 0) * multiplier;
            acc.Carbs += (log.Food?.Carbs ?? 0) * multiplier;
            acc.Fat += (log.Food?.Fat ?? 0) * multiplier;
            return acc;
        });

        return Ok(new
        {
            date = selectedDate,
            totalCalories = Math.Round(totals.Calories, 1),
            totalProtein = Math.Round(totals.Protein, 1),
            totalCarbs = Math.Round(totals.Carbs, 1),
            totalFat = Math.Round(totals.Fat, 1),
            logs = logs.OrderByDescending(l => l.Date).Select(ToLogResponse)
        });
    }

    [HttpPost]
    public async Task<IActionResult> LogNutrition([FromBody] LogNutritionDto request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        if (request.Quantity <= 0)
            return BadRequest(new { message = "Số lượng khẩu phần phải lớn hơn 0." });

        var foodExists = await _context.Foods.AnyAsync(f => f.Id == request.FoodId);
        if (!foodExists) return NotFound(new { message = "Không tìm thấy món ăn." });

        var logDate = request.Date ?? DateTime.UtcNow;
        var log = new NutritionLog
        {
            UserId = userId.Value,
            FoodId = request.FoodId,
            Quantity = request.Quantity,
            MealType = request.MealType,
            Date = logDate,
            LogDate = DateTime.UtcNow
        };

        _context.NutritionLogs.Add(log);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Lưu bữa ăn thành công!", logId = log.Id });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteLog(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var log = await _context.NutritionLogs.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId.Value);
        if (log == null) return NotFound(new { message = "Không tìm thấy nhật ký dinh dưỡng." });

        _context.NutritionLogs.Remove(log);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Đã xóa nhật ký dinh dưỡng." });
    }

    private static object ToLogResponse(NutritionLog n)
    {
        var quantity = Math.Max(0, n.Quantity);
        return new
        {
            n.Id,
            n.UserId,
            n.FoodId,
            FoodName = n.Food?.Name,
            n.Date,
            n.LogDate,
            n.MealType,
            n.Quantity,
            Calories = Math.Round((n.Food?.Calories ?? 0) * quantity, 1),
            Protein = Math.Round((n.Food?.Protein ?? 0) * quantity, 1),
            Carbs = Math.Round((n.Food?.Carbs ?? 0) * quantity, 1),
            Fat = Math.Round((n.Food?.Fat ?? 0) * quantity, 1),
            Food = n.Food
        };
    }

    private int? GetCurrentUserId()
    {
        var userIdString = User.FindFirst("userId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdString, out var userId) ? userId : null;
    }

    private sealed class NutritionTotals
    {
        public double Calories { get; set; }
        public double Protein { get; set; }
        public double Carbs { get; set; }
        public double Fat { get; set; }
    }
}
