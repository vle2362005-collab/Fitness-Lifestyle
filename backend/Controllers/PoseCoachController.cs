using System.Security.Claims;
using System.Text.Json;
using FitnessLifestyle.API.Data;
using FitnessLifestyle.API.Models;
using FitnessLifestyle.Coach;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FitnessLifestyle.API.Controllers;

[ApiController]
[Authorize]
[Route("api/pose-coach")]
public sealed class PoseCoachController(ApplicationDbContext db, CoachSessions sessions) : ControllerBase
{
    public sealed record StartRequest(int ExerciseId);
    public sealed record FramesRequest(List<PoseFrame?>? Frames);

    [HttpPost("replay")]
    [RequestSizeLimit(2_000_000)]
    public IActionResult Replay([FromBody] PoseReplayRequest request)
    {
        try { return Ok(PoseReplay.Analyze(request)); }
        catch (ArgumentException e) { return BadRequest(new { message = e.Message }); }
    }

    [HttpPost("sessions")]
    public async Task<IActionResult> Start(StartRequest request, CancellationToken ct)
    {
        if (UserId is not int userId) return Unauthorized();
        if (!await db.Users.AnyAsync(x => x.Id == userId, ct)) return Unauthorized();
        var exercise = await db.Exercises.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.ExerciseId, ct);
        if (exercise is null) return NotFound(new { message = "Không tìm thấy bài tập." });
        var key = ExerciseKey(exercise.Name);
        if (key is null) return BadRequest(new { message = "AI Coach hiện hỗ trợ Squat và Push-up chuẩn." });
        var session = sessions.Open(userId, exercise.Id, key);
        if (session is null) return StatusCode(429, new { message = "Đã đạt giới hạn phiên tập đang mở." });
        return Ok(new { sessionId = session.Id, exercise = key, engineVersion = PoseReplay.EngineVersion });
    }

    [HttpPost("sessions/{id:guid}/frames")]
    [RequestSizeLimit(128_000)]
    public async Task<IActionResult> Frames(Guid id, FramesRequest request, CancellationToken ct)
    {
        if (UserId is not int userId) return Unauthorized();
        var session = sessions.Get(id, userId);
        if (session is null) return MissingSession();
        if (request.Frames is not { Count: >= 1 and <= 16 } frames)
            return BadRequest(new { message = "Mỗi lần gửi cần từ 1 đến 16 mẫu." });

        await session.Lock.WaitAsync(ct);
        try
        {
            if (session.Cancelled) return MissingSession();
            if (session.Saved is not null) return Conflict(new { message = "Buổi tập đã kết thúc." });
            session.Tracker.Append(frames, acceptRetries: true);
            return Ok(new { latest = session.Tracker.Latest, trackedFrames = session.Tracker.TrackedFrames });
        }
        catch (ArgumentException e) { return BadRequest(new { message = e.Message }); }
        finally { session.Lock.Release(); }
    }

    [HttpPost("sessions/{id:guid}/finish")]
    public async Task<IActionResult> Finish(Guid id, CancellationToken ct)
    {
        if (UserId is not int userId) return Unauthorized();
        var session = sessions.Get(id, userId);
        if (session is null) return MissingSession();
        await session.Lock.WaitAsync(ct);
        try
        {
            if (session.Cancelled) return MissingSession();
            if (session.Saved is { } saved) return Ok(saved);
            var tracker = session.Tracker;
            if (tracker.Latest is not PoseStep result || tracker.TrackedFrames < 2)
                return BadRequest(new { message = "Chưa có đủ mẫu theo dõi để lưu." });

            var exercise = await db.Exercises.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == session.ExerciseId, ct);
            if (exercise is null || !await db.Users.AnyAsync(x => x.Id == userId, ct)) return MissingSession();
            var seconds = Math.Max(0.1, (result.TimestampMs - tracker.FirstTimestampMs.GetValueOrDefault()) / 1000d);
            var score = result.CompletedReps == 0 ? 0 :
                Math.Round(100d * result.FormOkReps / result.CompletedReps, 1);
            var calories = Math.Round(Math.Max(0, exercise.CaloriesPerMinute) * seconds / 60, 1);
            var now = DateTime.UtcNow;
            var workout = new WorkoutSession
            {
                UserId = userId, ExerciseId = exercise.Id, Date = now, PerformedAt = now,
                Reps = result.CompletedReps, Sets = result.CompletedReps > 0 ? 1 : 0,
                DurationMinutes = Math.Max(1, (int)Math.Ceiling(seconds / 60)),
                DurationInSeconds = seconds, AccuracyScore = score, CaloriesBurned = calories
            };
            var analysis = new WorkoutAnalysis
            {
                UserId = userId, ExerciseId = exercise.Id, WorkoutSession = workout,
                TotalReps = workout.Reps, TotalSets = workout.Sets, DurationInSeconds = seconds,
                AccuracyScore = score, CaloriesBurned = calories, AnalysisType = "coach_server", Status = "completed",
                FeedbackSummary = $"{result.FormOkReps}/{result.CompletedReps} rep đạt luật tư thế; {result.PartialAttempts} lượt chưa đủ biên độ.",
                RawResultJson = JsonSerializer.Serialize(new {
                    engine = PoseReplay.EngineVersion, result.CompletedReps, result.FormOkReps,
                    result.PartialAttempts, tracker.TrackedFrames, tracker.TotalFrames
                }),
                CreatedAt = now
            };
            db.WorkoutAnalyses.Add(analysis);
            // One commit for both dependent rows. Once saving begins, don't abandon it on disconnect.
            await db.SaveChangesAsync(CancellationToken.None);
            var response = new CoachSessions.SavedWorkout(workout.Id, analysis.Id, result, seconds);
            session.Saved = response;
            return Ok(response);
        }
        finally { session.Lock.Release(); }
    }

    [HttpDelete("sessions/{id:guid}")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        if (UserId is not int userId) return Unauthorized();
        var session = sessions.Get(id, userId);
        if (session is null) return NoContent();
        await session.Lock.WaitAsync(ct);
        try
        {
            if (session.Saved is null) session.Cancelled = true;
            return NoContent();
        }
        finally { session.Lock.Release(); }
    }

    private int? UserId => int.TryParse(User.FindFirstValue("userId") ??
        User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    private NotFoundObjectResult MissingSession() => NotFound(new { message = "Phiên tập không tồn tại hoặc đã hết hạn." });
    private static string? ExerciseKey(string name) => name.Trim().ToLowerInvariant() switch
    {
        "squat" => "squat",
        "push-up" or "pushup" or "push up" => "pushup",
        _ => null
    };
}
