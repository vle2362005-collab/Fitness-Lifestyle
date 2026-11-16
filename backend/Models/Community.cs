namespace FitnessLifestyle.API.Models;

public sealed class CommunityPost
{
    public int Id { get; set; }
    public int AuthorId { get; set; }
    public User Author { get; set; } = null!;
    public string Content { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? ExerciseName { get; set; }
    public int? Reps { get; set; }
    public double? DurationSeconds { get; set; }
    public ICollection<CommunityComment> Comments { get; set; } = new List<CommunityComment>();
    public ICollection<CommunityLike> Likes { get; set; } = new List<CommunityLike>();
}

public sealed class CommunityComment
{
    public int Id { get; set; }
    public int PostId { get; set; }
    public CommunityPost Post { get; set; } = null!;
    public int AuthorId { get; set; }
    public User Author { get; set; } = null!;
    public string Content { get; set; } = "";
    public bool IsSuggestion { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class CommunityLike
{
    public int PostId { get; set; }
    public CommunityPost Post { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
}
