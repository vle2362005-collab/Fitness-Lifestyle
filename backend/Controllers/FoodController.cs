using FitnessLifestyle.API.Data;
using FitnessLifestyle.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FitnessLifestyle.API.Controllers;

public class FoodDto
{
    public string Name { get; set; } = string.Empty;
    public double Calories { get; set; }
    public double Protein { get; set; }
    public double Carbs { get; set; }
    public double Fat { get; set; }
    public string? ImageUrl { get; set; }
}

[Route("api/[controller]")]
[ApiController]
public class FoodController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public FoodController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll([FromQuery] string? search)
    {
        var query = _context.Foods.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(f => f.Name.ToLower().Contains(keyword));
        }

        return Ok(await query.OrderBy(f => f.Name).ToListAsync());
    }

    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(int id)
    {
        var food = await _context.Foods.AsNoTracking().FirstOrDefaultAsync(f => f.Id == id);
        return food == null ? NotFound(new { message = "Không tìm thấy món ăn." }) : Ok(food);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] FoodDto request)
    {
        var validation = ValidateRequest(request);
        if (validation != null) return validation;

        var food = new Food
        {
            Name = request.Name.Trim(),
            Calories = Math.Max(0, request.Calories),
            Protein = Math.Max(0, request.Protein),
            Carbs = Math.Max(0, request.Carbs),
            Fat = Math.Max(0, request.Fat),
            ImageUrl = NormalizeNullable(request.ImageUrl)
        };

        _context.Foods.Add(food);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Thêm món ăn thành công.", food });
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, [FromBody] FoodDto request)
    {
        var food = await _context.Foods.FindAsync(id);
        if (food == null) return NotFound(new { message = "Không tìm thấy món ăn." });

        var validation = ValidateRequest(request);
        if (validation != null) return validation;

        food.Name = request.Name.Trim();
        food.Calories = Math.Max(0, request.Calories);
        food.Protein = Math.Max(0, request.Protein);
        food.Carbs = Math.Max(0, request.Carbs);
        food.Fat = Math.Max(0, request.Fat);
        food.ImageUrl = NormalizeNullable(request.ImageUrl);

        await _context.SaveChangesAsync();
        return Ok(new { message = "Cập nhật món ăn thành công.", food });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var food = await _context.Foods.FindAsync(id);
        if (food == null) return NotFound(new { message = "Không tìm thấy món ăn." });

        _context.Foods.Remove(food);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã xóa món ăn." });
    }

    private BadRequestObjectResult? ValidateRequest(FoodDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Tên món ăn không được để trống." });
        if (request.Calories < 0 || request.Protein < 0 || request.Carbs < 0 || request.Fat < 0)
            return BadRequest(new { message = "Chỉ số dinh dưỡng không được âm." });
        return null;
    }

    private static string? NormalizeNullable(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
