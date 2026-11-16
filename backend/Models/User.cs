using System.Text.Json.Serialization;
using System.ComponentModel.DataAnnotations;

namespace FitnessLifestyle.API.Models;

public enum UserRole
{
    User = 0,
    Admin = 1
}

public class User
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    [Required, EmailAddress, MaxLength(100)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [JsonIgnore]
    public string PasswordHash { get; set; } = string.Empty;

    public UserRole Role { get; set; } = UserRole.User;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public virtual MedicalProfile? MedicalProfile { get; set; }
    public virtual ICollection<NutritionLog> NutritionLogs { get; set; } = new List<NutritionLog>();
    public virtual ICollection<WorkoutSession> WorkoutSessions { get; set; } = new List<WorkoutSession>();
    public virtual ICollection<WorkoutAnalysis> WorkoutAnalyses { get; set; } = new List<WorkoutAnalysis>();
}
