using FitnessLifestyle.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FitnessLifestyle.API.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public DashboardController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetSummary()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized(new { message = "Không tìm thấy userId trong Token." });

        var workoutQuery = _context.WorkoutSessions.AsNoTracking().Where(w => w.UserId == userId.Value);
        var analysisOnlyQuery = _context.WorkoutAnalyses.AsNoTracking().Where(a => a.UserId == userId.Value && a.WorkoutSessionId == null);

        var totalWorkoutSessions = await workoutQuery.CountAsync();
        var totalAnalysisOnly = await analysisOnlyQuery.CountAsync();
        var totalWorkouts = totalWorkoutSessions + totalAnalysisOnly;

        var caloriesFromWorkouts = await workoutQuery.SumAsync(w => (double?)w.CaloriesBurned) ?? 0;
        var caloriesFromAnalyses = await analysisOnlyQuery.SumAsync(a => (double?)a.CaloriesBurned) ?? 0;

        var totalMinutesFromWorkouts = await workoutQuery.SumAsync(w => (int?)w.DurationMinutes) ?? 0;
        var totalSecondsFromAnalyses = await analysisOnlyQuery.SumAsync(a => (double?)a.DurationInSeconds) ?? 0;

        var repsFromWorkouts = await workoutQuery.SumAsync(w => (int?)w.Reps) ?? 0;
        var repsFromAnalyses = await analysisOnlyQuery.SumAsync(a => (int?)a.TotalReps) ?? 0;
        var setsFromWorkouts = await workoutQuery.SumAsync(w => (int?)w.Sets) ?? 0;
        var setsFromAnalyses = await analysisOnlyQuery.SumAsync(a => (int?)a.TotalSets) ?? 0;

        var workoutAccuracies = await workoutQuery.Where(w => w.AccuracyScore > 0).Select(w => w.AccuracyScore).ToListAsync();
        var analysisAccuracies = await analysisOnlyQuery.Where(a => a.AccuracyScore > 0).Select(a => a.AccuracyScore).ToListAsync();
        var allAccuracies = workoutAccuracies.Concat(analysisAccuracies).ToList();
        var averageAccuracy = allAccuracies.Count == 0 ? 0 : allAccuracies.Average();

        var recentWorkouts = await workoutQuery
            .Include(w => w.Exercise)
            .OrderByDescending(w => w.Date)
            .Take(5)
            .Select(w => new
            {
                w.Id,
                w.ExerciseId,
                ExerciseName = w.Exercise != null ? w.Exercise.Name : "Bài tập",
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

        var recentAnalyses = await _context.WorkoutAnalyses
            .AsNoTracking()
            .Where(a => a.UserId == userId.Value)
            .Include(a => a.Exercise)
            .OrderByDescending(a => a.CreatedAt)
            .Take(5)
            .Select(a => new
            {
                a.Id,
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
                a.Status,
                a.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            totalWorkouts,
            totalWorkoutSessions,
            totalAnalysisOnly,
            caloriesBurned = Math.Round(caloriesFromWorkouts + caloriesFromAnalyses, 1),
            totalMinutes = totalMinutesFromWorkouts + (int)Math.Ceiling(totalSecondsFromAnalyses / 60),
            totalReps = repsFromWorkouts + repsFromAnalyses,
            totalSets = setsFromWorkouts + setsFromAnalyses,
            averageAccuracy = Math.Round(averageAccuracy, 1),
            recentWorkouts,
            recentAnalyses
        });
    }

    private int? GetCurrentUserId()
    {
        var userIdString = User.FindFirst("userId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdString, out var userId) ? userId : null;
    }
}
