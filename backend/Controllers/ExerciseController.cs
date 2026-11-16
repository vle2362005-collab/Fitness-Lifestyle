using FitnessLifestyle.API.Data;
using FitnessLifestyle.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace FitnessLifestyle.API.Controllers;

public class ExerciseUploadDto
{
    public string Name { get; set; } = string.Empty;
    public double CaloriesPerMinute { get; set; }
    public string? AiConfig { get; set; }
    public string? Description { get; set; }
    public string? Category { get; set; }
    public double MetValue { get; set; }

    // Tên chuẩn. Controller cũng tự nhận thêm các field phổ biến: image, imageFile, file, exerciseImage.
    public IFormFile? ImageFile { get; set; }
    public string? VideoUrl { get; set; }
}

[Route("api/[controller]")]
[ApiController]
public class ExerciseController : ControllerBase
{
    private static readonly string[] ImageFormFieldNames = ["ImageFile", "imageFile", "image", "file", "exerciseImage"];
    private static readonly string[] AllowedImageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

    private readonly ApplicationDbContext _context;
    private readonly IWebHostEnvironment _environment;

    public ExerciseController(ApplicationDbContext context, IWebHostEnvironment environment)
    {
        _context = context;
        _environment = environment;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll([FromQuery] string? category, [FromQuery] string? search)
    {
        var query = _context.Exercises.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(category))
        {
            var normalizedCategory = category.Trim().ToLower();
            query = query.Where(e => e.Category != null && e.Category.ToLower() == normalizedCategory);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(e =>
                e.Name.ToLower().Contains(keyword) ||
                (e.Description != null && e.Description.ToLower().Contains(keyword)) ||
                (e.Category != null && e.Category.ToLower().Contains(keyword)));
        }

        var exerciseEntities = await query
            .OrderByDescending(e => e.Id)
            .ToListAsync();

        return Ok(exerciseEntities.Select(ToResponse));
    }

    [HttpGet("categories")]
    [AllowAnonymous]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _context.Exercises
            .AsNoTracking()
            .Where(e => e.Category != null && e.Category != "")
            .Select(e => e.Category!)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();

        return Ok(categories);
    }

    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(int id)
    {
        var exercise = await _context.Exercises.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id);
        return exercise == null ? NotFound(new { message = "Không tìm thấy bài tập." }) : Ok(ToResponse(exercise));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> Create([FromForm] ExerciseUploadDto request)
    {
        var validation = ValidateRequest(request, requireCoreFields: true);
        if (validation != null) return validation;

        var imageResult = await SaveImageAsync(GetUploadedImage(request));
        if (!imageResult.Success) return BadRequest(new { message = imageResult.Error });

        var exercise = new Exercise
        {
            Name = request.Name.Trim(),
            CaloriesPerMinute = Math.Max(1, (int)Math.Round(request.CaloriesPerMinute)),
            Description = NormalizeNullable(request.Description),
            Category = NormalizeNullable(request.Category),
            MetValue = request.MetValue <= 0 ? EstimateMetValue(request.CaloriesPerMinute) : request.MetValue,
            AiConfig = NormalizeAiConfig(request.AiConfig),
            VideoUrl = NormalizeNullable(request.VideoUrl),
            ImageUrl = imageResult.Url ?? string.Empty
        };

        _context.Exercises.Add(exercise);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Thêm bài tập thành công!", exercise = ToResponse(exercise) });
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> Update(int id, [FromForm] ExerciseUploadDto request)
    {
        var exercise = await _context.Exercises.FindAsync(id);
        if (exercise == null) return NotFound(new { message = "Không tìm thấy bài tập." });

        var validation = ValidateRequest(request, requireCoreFields: true);
        if (validation != null) return validation;

        exercise.Name = request.Name.Trim();
        exercise.CaloriesPerMinute = Math.Max(1, (int)Math.Round(request.CaloriesPerMinute));
        exercise.Description = NormalizeNullable(request.Description);
        exercise.Category = NormalizeNullable(request.Category);
        exercise.MetValue = request.MetValue <= 0 ? EstimateMetValue(request.CaloriesPerMinute) : request.MetValue;
        exercise.AiConfig = NormalizeAiConfig(request.AiConfig);
        exercise.VideoUrl = NormalizeNullable(request.VideoUrl);

        var uploadedImage = GetUploadedImage(request);
        if (uploadedImage != null && uploadedImage.Length > 0)
        {
            var oldImageUrl = exercise.ImageUrl;
            var imageResult = await SaveImageAsync(uploadedImage);
            if (!imageResult.Success) return BadRequest(new { message = imageResult.Error });

            exercise.ImageUrl = imageResult.Url ?? string.Empty;
            DeleteLocalFile(oldImageUrl);
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = "Cập nhật bài tập thành công!", exercise = ToResponse(exercise) });
    }

    // Endpoint riêng cho lỗi thường gặp “không cập nhật được ảnh bài tập”.
    // Chấp nhận multipart field: ImageFile, imageFile, image, file hoặc exerciseImage.
    [HttpPut("{id:int}/image")]
    [HttpPost("{id:int}/image")]
    [Authorize(Roles = "Admin")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> UpdateImage(int id)
    {
        var exercise = await _context.Exercises.FindAsync(id);
        if (exercise == null) return NotFound(new { message = "Không tìm thấy bài tập." });

        var uploadedImage = GetUploadedImage(null);
        if (uploadedImage == null || uploadedImage.Length == 0)
            return BadRequest(new { message = "Vui lòng gửi file ảnh bằng form-data field ImageFile/image/file." });

        var oldImageUrl = exercise.ImageUrl;
        var imageResult = await SaveImageAsync(uploadedImage);
        if (!imageResult.Success) return BadRequest(new { message = imageResult.Error });

        exercise.ImageUrl = imageResult.Url ?? string.Empty;
        await _context.SaveChangesAsync();
        DeleteLocalFile(oldImageUrl);

        return Ok(new
        {
            message = "Cập nhật ảnh bài tập thành công!",
            exerciseId = exercise.Id,
            imageUrl = exercise.ImageUrl,
            exercise = ToResponse(exercise)
        });
    }

    [HttpDelete("{id:int}/image")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteImage(int id)
    {
        var exercise = await _context.Exercises.FindAsync(id);
        if (exercise == null) return NotFound(new { message = "Không tìm thấy bài tập." });

        var oldImageUrl = exercise.ImageUrl;
        exercise.ImageUrl = string.Empty;
        await _context.SaveChangesAsync();
        DeleteLocalFile(oldImageUrl);

        return Ok(new { message = "Đã xóa ảnh bài tập.", exercise = ToResponse(exercise) });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var exercise = await _context.Exercises.FindAsync(id);
        if (exercise == null) return NotFound(new { message = "Không tìm thấy bài tập." });

        var oldImageUrl = exercise.ImageUrl;
        _context.Exercises.Remove(exercise);
        await _context.SaveChangesAsync();
        DeleteLocalFile(oldImageUrl);

        return Ok(new { message = "Đã xóa bài tập!" });
    }

    private BadRequestObjectResult? ValidateRequest(ExerciseUploadDto request, bool requireCoreFields)
    {
        if (requireCoreFields && string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Tên bài tập không được để trống." });

        if (requireCoreFields && request.CaloriesPerMinute <= 0)
            return BadRequest(new { message = "Calories/Phút phải lớn hơn 0." });

        if (!string.IsNullOrWhiteSpace(request.AiConfig))
        {
            try
            {
                using var document = JsonDocument.Parse(request.AiConfig);
                if (!document.RootElement.TryGetProperty("mode", out _))
                    return BadRequest(new { message = "AiConfig thiếu thuộc tính mode." });
            }
            catch
            {
                return BadRequest(new { message = "AiConfig không phải JSON hợp lệ." });
            }
        }

        return null;
    }

    private IFormFile? GetUploadedImage(ExerciseUploadDto? dto)
    {
        if (dto?.ImageFile is { Length: > 0 }) return dto.ImageFile;
        if (!Request.HasFormContentType) return null;

        foreach (var fieldName in ImageFormFieldNames)
        {
            var file = Request.Form.Files.GetFile(fieldName);
            if (file is { Length: > 0 }) return file;
        }

        return Request.Form.Files.FirstOrDefault(f => f.Length > 0);
    }

    private async Task<(bool Success, string? Url, string? Error)> SaveImageAsync(IFormFile? file)
    {
        if (file == null || file.Length == 0) return (true, null, null);
        if (file.Length > 10_000_000) return (false, null, "Ảnh không được vượt quá 10MB.");

        if (!string.IsNullOrWhiteSpace(file.ContentType) && !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return (false, null, "File tải lên phải là ảnh.");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(extension)) extension = ".jpg";
        if (!AllowedImageExtensions.Contains(extension))
            return (false, null, "Định dạng ảnh hợp lệ: jpg, jpeg, png, gif, webp.");

        var webRoot = string.IsNullOrWhiteSpace(_environment.WebRootPath)
            ? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot")
            : _environment.WebRootPath;

        var uploadsFolder = Path.Combine(webRoot, "uploads", "exercises");
        Directory.CreateDirectory(uploadsFolder);

        var safeFileName = $"{Guid.NewGuid():N}{extension}";
        var filePath = Path.Combine(uploadsFolder, safeFileName);

        await using var fileStream = new FileStream(filePath, FileMode.Create);
        await file.CopyToAsync(fileStream);

        return (true, $"/uploads/exercises/{safeFileName}", null);
    }

    private void DeleteLocalFile(string? relativeUrl)
    {
        if (string.IsNullOrWhiteSpace(relativeUrl)) return;
        if (!relativeUrl.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase)) return;

        var webRoot = string.IsNullOrWhiteSpace(_environment.WebRootPath)
            ? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot")
            : _environment.WebRootPath;

        var relativePath = relativeUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.Combine(webRoot, relativePath);

        if (System.IO.File.Exists(fullPath)) System.IO.File.Delete(fullPath);
    }

    private static string? NormalizeAiConfig(string? aiConfig)
    {
        return string.IsNullOrWhiteSpace(aiConfig) ? null : aiConfig.Trim();
    }

    private static string? NormalizeNullable(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static double EstimateMetValue(double caloriesPerMinute)
    {
        // Công thức xấp xỉ cho người 70kg: kcal/min = MET * 3.5 * kg / 200.
        return Math.Round(Math.Max(1, caloriesPerMinute) * 200 / (3.5 * 70), 2);
    }

    private static object ToResponse(Exercise e)
    {
        return new
        {
            e.Id,
            e.Name,
            e.Description,
            e.Category,
            e.ImageUrl,
            e.VideoUrl,
            e.MetValue,
            e.AiConfig,
            e.PoseAngles,
            e.CaloriesPerMinute
        };
    }
}
