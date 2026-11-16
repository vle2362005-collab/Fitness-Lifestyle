using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FitnessLifestyle.API.Models;

public class WorkoutAnalysis
{
    [Key]
    public int Id { get; set; }

    public int UserId { get; set; }
    public int ExerciseId { get; set; }

    // Nullable: live camera có thể tạo WorkoutSession, video upload thì có thể không.
    public int? WorkoutSessionId { get; set; }

    // live_camera | upload_video | web_video
    [MaxLength(50)]
    public string AnalysisType { get; set; } = "upload_video";

    [MaxLength(255)]
    public string? VideoName { get; set; }

    // Đường dẫn tương đối trên server, ví dụ: /uploads/workout-analyses/abc.mp4
    public string? VideoUrl { get; set; }

    public int TotalReps { get; set; }
    public int TotalSets { get; set; }
    public double DurationInSeconds { get; set; }
    public double CaloriesBurned { get; set; }

    [Range(0, 100)]
    public double AccuracyScore { get; set; }

    public string? FeedbackSummary { get; set; }
    public string? DetectedErrorsJson { get; set; }
    public string? RawResultJson { get; set; }

    [MaxLength(50)]
    public string Status { get; set; } = "completed";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(UserId))]
    public virtual User? User { get; set; }

    [ForeignKey(nameof(ExerciseId))]
    public virtual Exercise? Exercise { get; set; }

    [ForeignKey(nameof(WorkoutSessionId))]
    public virtual WorkoutSession? WorkoutSession { get; set; }
}
