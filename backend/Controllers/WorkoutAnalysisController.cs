using FitnessLifestyle.API.Data;
using FitnessLifestyle.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FitnessLifestyle.API.Controllers;

public class CreateWorkoutAnalysisDto
{
    public int ExerciseId { get; set; }
    public int? WorkoutSessionId { get; set; }
    public string? AnalysisType { get; set; }
    public string? VideoName { get; set; }
    public string? VideoUrl { get; set; }
    public int TotalReps { get; set; }
    public int TotalSets { get; set; }
    public double DurationInSeconds { get; set; }
    public double CaloriesBurned { get; set; }
    public double AccuracyScore { get; set; }
    public string? FeedbackSummary { get; set; }
    public string? DetectedErrorsJson { get; set; }
    public string? RawResultJson { get; set; }
    public string? Status { get; set; }
    public bool CreateWorkoutSession { get; set; } = true;
}

public class UploadWorkoutAnalysisDto
{
    public int ExerciseId { get; set; }
    public int? WorkoutSessionId { get; set; }
    public string? AnalysisType { get; set; }
    public string? VideoName { get; set; }
    public int TotalReps { get; set; }
    public int TotalSets { get; set; }
    public double DurationInSeconds { get; set; }
    public double CaloriesBurned { get; set; }
    public double AccuracyScore { get; set; }
    public string? FeedbackSummary { get; set; }
    public string? DetectedErrorsJson { get; set; }
    public string? RawResultJson { get; set; }
    public string? Status { get; set; }
    public bool CreateWorkoutSession { get; set; } = true;

    // Tên chuẩn. Controller cũng tự nhận thêm các field phổ biến: videoFile, video, file, upload.
    public IFormFile? VideoFile { get; set; }
}

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class WorkoutAnalysisController : ControllerBase
{
    private static readonly string[] VideoFormFieldNames = ["VideoFile", "videoFile", "video", "file", "upload"];
    private static readonly string[] AllowedVideoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];

    private readonly ApplicationDbContext _context;
    private readonly IWebHostEnvironment _environment;

    public WorkoutAnalysisController(ApplicationDbContext context, IWebHostEnvironment environment)
    {
        _context = context;
        _environment = environment;
    }

    [HttpGet]
    public async Task<IActionResult> GetMyAnalyses()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var analyses = await _context.WorkoutAnalyses
            .AsNoTracking()
            .Include(a => a.Exercise)
            .Where(a => a.UserId == userId.Value)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        return Ok(analyses.Select(ToResponse));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var analysis = await _context.WorkoutAnalyses
            .AsNoTracking()
            .Include(a => a.Exercise)
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId.Value);

        return analysis == null
            ? NotFound(new { message = "Không tìm thấy kết quả phân tích." })
            : Ok(ToResponse(analysis));
    }

    // Lưu metadata/kết quả phân tích. Dùng cho Live Camera hoặc fallback khi không upload được file video.
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateWorkoutAnalysisDto request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var exercise = await ValidateAndGetExercise(userId.Value, request.ExerciseId, request.WorkoutSessionId);
        if (exercise.Result != null) return exercise.Result;

        var saveResult = await CreateAnalysisAsync(
            userId.Value,
            exercise.Value!,
            request.WorkoutSessionId,
            LegacyType(request.AnalysisType, "live_camera"),
            NormalizeNullable(request.VideoName),
            NormalizeNullable(request.VideoUrl),
            request.TotalReps,
            request.TotalSets,
            request.DurationInSeconds,
            request.CaloriesBurned,
            request.AccuracyScore,
            request.FeedbackSummary,
            request.DetectedErrorsJson,
            request.RawResultJson,
            request.Status,
            request.CreateWorkoutSession
        );

        return Ok(new
        {
            message = "Đã lưu kết quả phân tích vào Database.",
            analysisId = saveResult.Analysis.Id,
            workoutSessionId = saveResult.Analysis.WorkoutSessionId,
            saveResult.Analysis.VideoUrl
        });
    }

    // Upload video + lưu kết quả phân tích. App React Native dùng endpoint này cho chức năng Upload Video.
    [HttpPost("upload")]
    [RequestSizeLimit(250_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 250_000_000)]
    public async Task<IActionResult> Upload([FromForm] UploadWorkoutAnalysisDto request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var exercise = await ValidateAndGetExercise(userId.Value, request.ExerciseId, request.WorkoutSessionId);
        if (exercise.Result != null) return exercise.Result;

        string? videoUrl = null;
        string? originalFileName = NormalizeNullable(request.VideoName);

        var videoFile = GetUploadedVideo(request);
        if (videoFile != null && videoFile.Length > 0)
        {
            var videoResult = await SaveVideoAsync(videoFile);
            if (!videoResult.Success) return BadRequest(new { message = videoResult.Error });

            originalFileName = videoResult.OriginalFileName;
            videoUrl = videoResult.Url;
        }

        var saveResult = await CreateAnalysisAsync(
            userId.Value,
            exercise.Value!,
            request.WorkoutSessionId,
            LegacyType(request.AnalysisType, "upload_video"),
            originalFileName,
            videoUrl,
            request.TotalReps,
            request.TotalSets,
            request.DurationInSeconds,
            request.CaloriesBurned,
            request.AccuracyScore,
            request.FeedbackSummary,
            request.DetectedErrorsJson,
            request.RawResultJson,
            request.Status,
            request.CreateWorkoutSession
        );

        return Ok(new
        {
            message = "Đã upload video và lưu kết quả phân tích vào Database.",
            analysisId = saveResult.Analysis.Id,
            workoutSessionId = saveResult.Analysis.WorkoutSessionId,
            saveResult.Analysis.VideoUrl
        });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var analysis = await _context.WorkoutAnalyses.FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId.Value);
        if (analysis == null) return NotFound(new { message = "Không tìm thấy kết quả phân tích." });

        var videoUrl = analysis.VideoUrl;
        _context.WorkoutAnalyses.Remove(analysis);
        await _context.SaveChangesAsync();
        DeleteLocalFile(videoUrl);

        return Ok(new { message = "Đã xóa kết quả phân tích." });
    }

    private async Task<(WorkoutAnalysis Analysis, WorkoutSession? Session)> CreateAnalysisAsync(
        int userId,
        Exercise exercise,
        int? workoutSessionId,
        string analysisType,
        string? videoName,
        string? videoUrl,
        int totalReps,
        int totalSets,
        double durationInSeconds,
        double caloriesBurned,
        double accuracyScore,
        string? feedbackSummary,
        string? detectedErrorsJson,
        string? rawResultJson,
        string? status,
        bool createWorkoutSession)
    {
        var normalizedDurationSeconds = Math.Max(0, durationInSeconds);
        var normalizedCalories = caloriesBurned > 0
            ? caloriesBurned
            : CalculateFallbackCalories(exercise, normalizedDurationSeconds);
        var normalizedReps = Math.Max(0, totalReps);
        var normalizedSets = Math.Max(0, totalSets);
        var normalizedAccuracy = Math.Clamp(accuracyScore, 0, 100);

        await using var transaction = await _context.Database.BeginTransactionAsync();

        WorkoutSession? session = null;
        if (!workoutSessionId.HasValue && createWorkoutSession)
        {
            session = new WorkoutSession
            {
                UserId = userId,
                ExerciseId = exercise.Id,
                DurationMinutes = Math.Max(1, (int)Math.Ceiling(normalizedDurationSeconds / 60)),
                DurationInSeconds = normalizedDurationSeconds,
                Reps = normalizedReps,
                Sets = normalizedSets,
                CaloriesBurned = normalizedCalories,
                AccuracyScore = normalizedAccuracy,
                Date = DateTime.UtcNow,
                PerformedAt = DateTime.UtcNow
            };

            _context.WorkoutSessions.Add(session);
            await _context.SaveChangesAsync();
            workoutSessionId = session.Id;
        }

        var analysis = new WorkoutAnalysis
        {
            UserId = userId,
            ExerciseId = exercise.Id,
            WorkoutSessionId = workoutSessionId,
            AnalysisType = analysisType,
            VideoName = videoName,
            VideoUrl = videoUrl,
            TotalReps = normalizedReps,
            TotalSets = normalizedSets,
            DurationInSeconds = normalizedDurationSeconds,
            CaloriesBurned = normalizedCalories,
            AccuracyScore = normalizedAccuracy,
            FeedbackSummary = NormalizeNullable(feedbackSummary),
            DetectedErrorsJson = NormalizeNullable(detectedErrorsJson),
            RawResultJson = NormalizeNullable(rawResultJson),
            Status = NormalizeText(status, "completed"),
            CreatedAt = DateTime.UtcNow
        };

        _context.WorkoutAnalyses.Add(analysis);
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return (analysis, session);
    }

    private async Task<(Exercise? Value, IActionResult? Result)> ValidateAndGetExercise(int userId, int exerciseId, int? workoutSessionId)
    {
        var exercise = await _context.Exercises.FirstOrDefaultAsync(e => e.Id == exerciseId);
        if (exercise == null) return (null, NotFound(new { message = "Không tìm thấy bài tập." }));

        if (workoutSessionId.HasValue)
        {
            var workoutBelongsToUser = await _context.WorkoutSessions
                .AnyAsync(w => w.Id == workoutSessionId.Value && w.UserId == userId);

            if (!workoutBelongsToUser)
                return (null, BadRequest(new { message = "Buổi tập không thuộc tài khoản hiện tại." }));
        }

        return (exercise, null);
    }

    private IFormFile? GetUploadedVideo(UploadWorkoutAnalysisDto? dto)
    {
        if (dto?.VideoFile is { Length: > 0 }) return dto.VideoFile;
        if (!Request.HasFormContentType) return null;

        foreach (var fieldName in VideoFormFieldNames)
        {
            var file = Request.Form.Files.GetFile(fieldName);
            if (file is { Length: > 0 }) return file;
        }

        return Request.Form.Files.FirstOrDefault(f => f.Length > 0);
    }

    private async Task<(bool Success, string? Url, string? Error, string? OriginalFileName)> SaveVideoAsync(IFormFile file)
    {
        if (file.Length > 250_000_000) return (false, null, "Video không được vượt quá 250MB.", null);

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(extension)) extension = ".mp4";

        if (!AllowedVideoExtensions.Contains(extension))
            return (false, null, "Định dạng video hợp lệ: mp4, mov, avi, mkv, webm, m4v.", null);

        if (!IsVideoContentType(file.ContentType))
            return (false, null, "File tải lên phải là video.", null);

        var webRoot = string.IsNullOrWhiteSpace(_environment.WebRootPath)
            ? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot")
            : _environment.WebRootPath;

        var uploadFolder = Path.Combine(webRoot, "uploads", "workout-analyses");
        Directory.CreateDirectory(uploadFolder);

        var originalFileName = Path.GetFileName(file.FileName);
        var savedFileName = $"{Guid.NewGuid():N}{extension}";
        var savedPath = Path.Combine(uploadFolder, savedFileName);

        await using (var stream = System.IO.File.Create(savedPath))
        {
            await file.CopyToAsync(stream);
        }

        return (true, $"/uploads/workout-analyses/{savedFileName}", null, originalFileName);
    }

    private static bool IsVideoContentType(string? contentType)
    {
        if (string.IsNullOrWhiteSpace(contentType)) return true;
        return contentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase)
            || contentType.Equals("application/octet-stream", StringComparison.OrdinalIgnoreCase);
    }

    private static double CalculateFallbackCalories(Exercise exercise, double durationInSeconds)
    {
        if (durationInSeconds <= 0) return 0;
        var caloriesPerMinute = exercise.CaloriesPerMinute > 0 ? exercise.CaloriesPerMinute : Math.Max(1, exercise.MetValue);
        return Math.Round(caloriesPerMinute * (durationInSeconds / 60), 1);
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

    private static object ToResponse(WorkoutAnalysis a)
    {
        return new
        {
            a.Id,
            a.UserId,
            a.ExerciseId,
            ExerciseName = a.Exercise != null ? a.Exercise.Name : "Bài tập",
            a.WorkoutSessionId,
            a.AnalysisType,
            a.VideoName,
            a.VideoUrl,
            a.TotalReps,
            a.TotalSets,
            a.DurationInSeconds,
            a.CaloriesBurned,
            a.AccuracyScore,
            a.FeedbackSummary,
            a.DetectedErrorsJson,
            a.RawResultJson,
            a.Status,
            a.CreatedAt
        };
    }

    private static string LegacyType(string? value, string fallback)
    {
        var type = NormalizeText(value, fallback);
        if (type.Length > 50 || type.Equals("coach_server", StringComparison.OrdinalIgnoreCase))
            return fallback;
        return type;
    }

    private static string NormalizeText(string? value, string fallback)
    {
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }

    private static string? NormalizeNullable(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private int? GetCurrentUserId()
    {
        var userIdString = User.FindFirst("userId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdString, out var userId) ? userId : null;
    }
}
