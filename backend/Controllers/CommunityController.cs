using System.Security.Claims;
using FitnessLifestyle.API.Data;
using FitnessLifestyle.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace FitnessLifestyle.API.Controllers;

[ApiController]
[Authorize]
[Route("api/community/posts")]
[RequestSizeLimit(32_000)]
public sealed class CommunityController(ApplicationDbContext db) : ControllerBase
{
    public sealed record WritePost(string? Content, int? AnalysisId);
    public sealed record WriteComment(string? Content, bool IsSuggestion);

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int? before, CancellationToken ct)
    {
        if (UserId is not int userId) return Unauthorized();
        var limit = 15;
        var query = db.CommunityPosts.AsNoTracking();
        if (before is int cursor) query = query.Where(p => p.Id < cursor);
        var posts = await query.OrderByDescending(p => p.Id).Take(limit + 1)
            .Select(p => new {
                p.Id, p.Content, p.CreatedAt, p.UpdatedAt,
                Author = p.Author.Username, IsMine = p.AuthorId == userId,
                LikeCount = p.Likes.Count, Liked = p.Likes.Any(l => l.UserId == userId),
                CommentCount = p.Comments.Count,
                p.ExerciseName, p.Reps, p.DurationSeconds
            }).ToListAsync(ct);
        return Ok(new { items = posts.Take(limit), nextBefore = posts.Count > limit ? (int?)posts[limit - 1].Id : null });
    }

    [HttpPost]
    public async Task<IActionResult> Create(WritePost request, CancellationToken ct)
    {
        if (UserId is not int userId || !await db.Users.AnyAsync(u => u.Id == userId, ct)) return Unauthorized();
        var content = request.Content?.Trim();
        if (string.IsNullOrEmpty(content) || content.Length > 1500) return InvalidContent(1500);
        var post = new CommunityPost { AuthorId = userId, Content = content, CreatedAt = DateTime.UtcNow };
        if (request.AnalysisId is int analysisId)
        {
            // Only the author may share a private analysis; persist only the public summary.
            var summary = await db.WorkoutAnalyses.AsNoTracking()
                .Where(a => a.Id == analysisId && a.UserId == userId)
                .Select(a => new { Name = a.Exercise!.Name, a.TotalReps, a.DurationInSeconds })
                .FirstOrDefaultAsync(ct);
            if (summary is null) return NotFound(new { message = "Không tìm thấy buổi tập của bạn." });
            post.ExerciseName = summary.Name;
            post.Reps = summary.TotalReps;
            post.DurationSeconds = summary.DurationInSeconds;
        }
        db.CommunityPosts.Add(post);
        await db.SaveChangesAsync(ct);
        return Ok(new { post.Id });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Edit(int id, WritePost request, CancellationToken ct)
    {
        if (UserId is not int userId) return Unauthorized();
        var content = request.Content?.Trim();
        if (string.IsNullOrEmpty(content) || content.Length > 1500) return InvalidContent(1500);
        var post = await db.CommunityPosts.FirstOrDefaultAsync(p => p.Id == id && p.AuthorId == userId, ct);
        if (post is null) return NotFound(new { message = "Bạn chỉ có thể sửa bài của mình." });
        post.Content = content;
        post.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (UserId is not int userId) return Unauthorized();
        var count = await db.CommunityPosts.Where(p => p.Id == id && p.AuthorId == userId).ExecuteDeleteAsync(ct);
        if (count == 0) return NotFound(new { message = "Bạn chỉ có thể xóa bài của mình." });
        return NoContent();
    }

    [HttpPut("{id:int}/like")]
    public async Task<IActionResult> Like(int id, CancellationToken ct)
    {
        if (UserId is not int userId || !await db.Users.AnyAsync(u => u.Id == userId, ct)) return Unauthorized();
        if (!await db.CommunityPosts.AnyAsync(p => p.Id == id, ct)) return NotFound();
        if (await db.CommunityLikes.AnyAsync(l => l.PostId == id && l.UserId == userId, ct)) return NoContent();
        db.CommunityLikes.Add(new CommunityLike { PostId = id, UserId = userId });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException e) when (e.InnerException is SqlException { Number: 2601 or 2627 }) { }
        catch (DbUpdateException e) when (e.InnerException is SqlException { Number: 547 }) { return NotFound(); }
        return NoContent();
    }

    [HttpDelete("{id:int}/like")]
    public async Task<IActionResult> Unlike(int id, CancellationToken ct)
    {
        if (UserId is not int userId) return Unauthorized();
        await db.CommunityLikes.Where(l => l.PostId == id && l.UserId == userId).ExecuteDeleteAsync(ct);
        return NoContent();
    }

    [HttpGet("{id:int}/comments")]
    public async Task<IActionResult> Comments(int id, [FromQuery] int? before, CancellationToken ct)
    {
        if (UserId is not int userId) return Unauthorized();
        if (!await db.CommunityPosts.AnyAsync(p => p.Id == id, ct)) return NotFound();
        var query = db.CommunityComments.AsNoTracking().Where(c => c.PostId == id);
        if (before is int cursor) query = query.Where(c => c.Id < cursor);
        var rows = await query.OrderByDescending(c => c.Id).Take(31)
            .Select(c => new {
                c.Id, c.Content, c.CreatedAt, c.IsSuggestion,
                Author = c.Author.Username, IsMine = c.AuthorId == userId
            }).ToListAsync(ct);
        return Ok(new { items = rows.Take(30), nextBefore = rows.Count > 30 ? (int?)rows[29].Id : null });
    }

    [HttpPost("{id:int}/comments")]
    public async Task<IActionResult> AddComment(int id, WriteComment request, CancellationToken ct)
    {
        if (UserId is not int userId || !await db.Users.AnyAsync(u => u.Id == userId, ct)) return Unauthorized();
        var content = request.Content?.Trim();
        if (string.IsNullOrEmpty(content) || content.Length > 500) return InvalidContent(500);
        if (!await db.CommunityPosts.AnyAsync(p => p.Id == id, ct)) return NotFound();
        var comment = new CommunityComment {
            PostId = id, AuthorId = userId, Content = content, IsSuggestion = request.IsSuggestion,
            CreatedAt = DateTime.UtcNow
        };
        db.CommunityComments.Add(comment);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException e) when (e.InnerException is SqlException { Number: 547 }) { return NotFound(); }
        return Ok(new { comment.Id });
    }

    [HttpDelete("{id:int}/comments/{commentId:int}")]
    public async Task<IActionResult> DeleteComment(int id, int commentId, CancellationToken ct)
    {
        if (UserId is not int userId) return Unauthorized();
        var count = await db.CommunityComments.Where(c => c.Id == commentId &&
            c.PostId == id && c.AuthorId == userId).ExecuteDeleteAsync(ct);
        if (count == 0) return NotFound();
        return NoContent();
    }

    private int? UserId => int.TryParse(User.FindFirstValue("userId") ??
        User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    private BadRequestObjectResult InvalidContent(int max) =>
        BadRequest(new { message = $"Nội dung cần từ 1 đến {max} ký tự." });
}
