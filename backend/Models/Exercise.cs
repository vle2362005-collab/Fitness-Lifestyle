using System.ComponentModel.DataAnnotations;

namespace FitnessLifestyle.API.Models;

public class Exercise
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }
    public string? Category { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public string? VideoUrl { get; set; }
    public double MetValue { get; set; }

    // JSON cấu hình AI, ví dụ:
    // { "mode":"angle", "points":["left_hip","left_knee","left_ankle"], ... }
    public string? AiConfig { get; set; }

    // Giữ lại để tương thích dữ liệu cũ nếu đã có.
    public string? PoseAngles { get; set; }

    public int CaloriesPerMinute { get; set; }

    public virtual ICollection<WorkoutSession> WorkoutSessions { get; set; } = new List<WorkoutSession>();
    public virtual ICollection<WorkoutAnalysis> WorkoutAnalyses { get; set; } = new List<WorkoutAnalysis>();
}
