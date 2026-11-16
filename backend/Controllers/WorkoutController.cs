using FitnessLifestyle.API.Data;
using FitnessLifestyle.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FitnessLifestyle.API.Controllers;

public class LogWorkoutDto
{
    public int ExerciseId { get; set; }
    public int DurationMinutes { get; set; }
    public double? DurationInSeconds { get; set; }
    public int? Reps { get; set; }
    public int? Sets { get; set; }
    public double? CaloriesBurned { get; set; }
    public double? AccuracyScore { get; set; }
    public DateTime? PerformedAt { get; set; }
}

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class WorkoutController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public WorkoutController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetMyWorkouts([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var query = _context.WorkoutSessions
            .AsNoTracking()
            .Include(w => w.Exercise)
            .Where(w => w.UserId == userId.Value);

        if (from.HasValue) query = query.Where(w => w.Date >= from.Value.Date);
        if (to.HasValue) query = query.Where(w => w.Date < to.Value.Date.AddDays(1));

        var workouts = await query
            .OrderByDescending(w => w.Date)
            .Select(w => new
            {
                w.Id,
                w.ExerciseId,
                ExerciseName = w.Exercise != null ? w.Exercise.Name : "Bài tập",
                ExerciseImageUrl = w.Exercise != null ? w.Exercise.ImageUrl : string.Empty,
                w.DurationMinutes,
                w.DurationInSeconds,
                w.Reps,
                w.Sets,
                w.CaloriesBurned,
                w.AccuracyScore,
                w.Date,
                w.PerformedAt
            })
            .ToListAsync();

        return Ok(workouts);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var workout = await _context.WorkoutSessions
            .AsNoTracking()
            .Include(w => w.Exercise)
            .Where(w => w.Id == id && w.UserId == userId.Value)
            .Select(w => new
            {
                w.Id,
                w.ExerciseId,
                ExerciseName = w.Exercise != null ? w.Exercise.Name : "Bài tập",
                ExerciseImageUrl = w.Exercise != null ? w.Exercise.ImageUrl : string.Empty,
                w.DurationMinutes,
                w.DurationInSeconds,
                w.Reps,
                w.Sets,
                w.CaloriesBurned,
                w.AccuracyScore,
                w.Date,
                w.PerformedAt
            })
            .FirstOrDefaultAsync();

        return workout == null ? NotFound(new { message = "Không tìm thấy buổi tập." }) : Ok(workout);
    }

    [HttpPost]
    public async Task<IActionResult> LogWorkout([FromBody] LogWorkoutDto request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var exercise = await _context.Exercises.FindAsync(request.ExerciseId);
        if (exercise == null) return NotFound(new { message = "Không tìm thấy bài tập này." });

        var session = BuildSession(userId.Value, exercise, request);

        _context.WorkoutSessions.Add(session);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Lưu bài tập thành công!",
            workoutId = session.Id,
            caloriesBurned = session.CaloriesBurned
        });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateWorkout(int id, [FromBody] LogWorkoutDto request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var session = await _context.WorkoutSessions.FirstOrDefaultAsync(w => w.Id == id && w.UserId == userId.Value);
        if (session == null) return NotFound(new { message = "Không tìm thấy buổi tập." });

        var exercise = await _context.Exercises.FindAsync(request.ExerciseId);
        if (exercise == null) return NotFound(new { message = "Không tìm thấy bài tập này." });

        var updated = BuildSession(userId.Value, exercise, request);
        session.ExerciseId = updated.ExerciseId;
        session.DurationMinutes = updated.DurationMinutes;
        session.DurationInSeconds = updated.DurationInSeconds;
        session.Reps = updated.Reps;
        session.Sets = updated.Sets;
        session.AccuracyScore = updated.AccuracyScore;
        session.CaloriesBurned = updated.CaloriesBurned;
        session.Date = updated.Date;
        session.PerformedAt = updated.PerformedAt;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Cập nhật buổi tập thành công.", workoutId = session.Id });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteWorkout(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Token không hợp lệ." });

        var session = await _context.WorkoutSessions.FirstOrDefaultAsync(w => w.Id == id && w.UserId == userId.Value);
        if (session == null) return NotFound(new { message = "Không tìm thấy buổi tập." });

        var linkedAnalyses = await _context.WorkoutAnalyses
            .Where(a => a.WorkoutSessionId == session.Id && a.UserId == userId.Value)
            .ToListAsync();

        foreach (var analysis in linkedAnalyses)
        {
            analysis.WorkoutSessionId = null;
        }

        _context.WorkoutSessions.Remove(session);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã xóa buổi tập.", detachedAnalyses = linkedAnalyses.Count });
    }

    private static WorkoutSession BuildSession(int userId, Exercise exercise, LogWorkoutDto request)
    {
        var durationSeconds = Math.Max(0, request.DurationInSeconds ?? request.DurationMinutes * 60);
        var durationMinutes = request.DurationMinutes > 0
            ? request.DurationMinutes
            : Math.Max(1, (int)Math.Ceiling(durationSeconds / 60));

        if (durationSeconds <= 0) durationSeconds = durationMinutes * 60;

        var calculatedCalories = request.CaloriesBurned is > 0
            ? request.CaloriesBurned.Value
            : exercise.CaloriesPerMinute * durationMinutes;

        var performedAt = request.PerformedAt ?? DateTime.UtcNow;

        return new WorkoutSession
        {
            UserId = userId,
            ExerciseId = exercise.Id,
            DurationMinutes = durationMinutes,
            DurationInSeconds = durationSeconds,
            Reps = Math.Max(0, request.Reps ?? 0),
            Sets = Math.Max(0, request.Sets ?? 0),
            AccuracyScore = Math.Clamp(request.AccuracyScore ?? 0, 0, 100),
            CaloriesBurned = Math.Max(0, calculatedCalories),
            Date = performedAt,
            PerformedAt = performedAt
        };
    }

    private int? GetCurrentUserId()
    {
        var userIdString = User.FindFirst("userId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdString, out var userId) ? userId : null;
    }
}
