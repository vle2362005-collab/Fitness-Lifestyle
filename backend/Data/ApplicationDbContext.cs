using FitnessLifestyle.API.Models;
using Microsoft.EntityFrameworkCore;

namespace FitnessLifestyle.API.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<MedicalProfile> MedicalProfiles { get; set; }
    public DbSet<Food> Foods { get; set; }
    public DbSet<NutritionLog> NutritionLogs { get; set; }
    public DbSet<Exercise> Exercises { get; set; }
    public DbSet<WorkoutSession> WorkoutSessions { get; set; }
    public DbSet<WorkoutAnalysis> WorkoutAnalyses { get; set; }
    public DbSet<Badge> Badges { get; set; }
    public DbSet<UserBadge> UserBadges { get; set; }

    public DbSet<CommunityPost> CommunityPosts => Set<CommunityPost>();
    public DbSet<CommunityComment> CommunityComments => Set<CommunityComment>();
    public DbSet<CommunityLike> CommunityLikes => Set<CommunityLike>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<CommunityPost>(e =>
        {
            e.Property(x => x.Content).HasMaxLength(1500);
            e.Property(x => x.ExerciseName).HasMaxLength(160);
            e.HasOne(x => x.Author).WithMany().HasForeignKey(x => x.AuthorId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<CommunityComment>(e =>
        {
            e.Property(x => x.Content).HasMaxLength(500);
            e.HasIndex(x => new { x.PostId, x.Id });
            e.HasOne(x => x.Post).WithMany(x => x.Comments).HasForeignKey(x => x.PostId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Author).WithMany().HasForeignKey(x => x.AuthorId)
                .OnDelete(DeleteBehavior.NoAction);
        });
        modelBuilder.Entity<CommunityLike>(e =>
        {
            e.HasKey(x => new { x.PostId, x.UserId });
            e.HasOne(x => x.Post).WithMany(x => x.Likes).HasForeignKey(x => x.PostId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.NoAction);
        });


        modelBuilder.Entity<User>()
            .HasOne(u => u.MedicalProfile)
            .WithOne(p => p.User)
            .HasForeignKey<MedicalProfile>(p => p.UserId);

        modelBuilder.Entity<WorkoutAnalysis>()
            .HasOne(a => a.User)
            .WithMany()
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<WorkoutAnalysis>()
            .HasOne(a => a.Exercise)
            .WithMany()
            .HasForeignKey(a => a.ExerciseId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<WorkoutAnalysis>()
            .HasOne(a => a.WorkoutSession)
            .WithMany()
            .HasForeignKey(a => a.WorkoutSessionId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<Exercise>().HasData(
            new Exercise
            {
                Id = 1,
                Name = "Squat",
                Category = "Legs",
                Description = "Bài tập đứng lên ngồi xuống cho cơ đùi và mông.",
                MetValue = 5.0,
                CaloriesPerMinute = 8,
                VideoUrl = "squat_tutorial.mp4",
                AiConfig = "{\"mode\":\"angle\",\"metricName\":\"Góc đầu gối\",\"points\":[\"left_hip\",\"left_knee\",\"left_ankle\"],\"minScore\":0.4,\"downRule\":{\"operator\":\"<\",\"value\":100,\"feedback\":\"Đùi đã song song! Đứng lên!\"},\"upRule\":{\"operator\":\">\",\"value\":160},\"missingFeedback\":\"Vui lòng đứng xa camera để AI thấy hông, gối và cổ chân!\",\"warningFeedback\":\"Ngồi sâu xuống nữa!\"}"
            },
            new Exercise
            {
                Id = 2,
                Name = "Push-up",
                Category = "Chest",
                Description = "Bài tập hít đất cho cơ ngực và tay sau.",
                MetValue = 8.0,
                CaloriesPerMinute = 9,
                VideoUrl = "pushup_tutorial.mp4",
                AiConfig = "{\"mode\":\"angle\",\"metricName\":\"Góc khuỷu tay\",\"points\":[\"left_shoulder\",\"left_elbow\",\"left_wrist\"],\"minScore\":0.4,\"downRule\":{\"operator\":\"<\",\"value\":90,\"feedback\":\"Góc đẹp! Đẩy mạnh lên!\"},\"upRule\":{\"operator\":\">\",\"value\":150},\"missingFeedback\":\"Vui lòng quay ngang người để AI thấy cánh tay!\",\"warningFeedback\":\"Hạ khuỷu tay xuống nữa!\"}"
            },
            new Exercise
            {
                Id = 3,
                Name = "Plank",
                Category = "Abs",
                Description = "Bài tập giữ người thẳng cho cơ lõi (core).",
                MetValue = 3.0,
                CaloriesPerMinute = 4,
                VideoUrl = "plank_tutorial.mp4",
                AiConfig = "{\"mode\":\"vertical\",\"point\":\"nose\",\"minScore\":0.5,\"threshold\":40,\"missingFeedback\":\"AI chưa thấy rõ khuôn mặt!\",\"downFeedback\":\"Tốt! Tiếp tục giữ nhịp.\",\"upFeedback\":\"Hoàn thành một nhịp!\"}"
            }
        );

        modelBuilder.Entity<Food>().HasData(
            new Food { Id = 1, Name = "Ức gà (100g)", Calories = 165, Protein = 31, Carbs = 0, Fat = 3.6 },
            new Food { Id = 2, Name = "Gạo lứt (100g)", Calories = 110, Protein = 2.6, Carbs = 23, Fat = 0.9 },
            new Food { Id = 3, Name = "Trứng gà (1 quả)", Calories = 78, Protein = 6, Carbs = 0.6, Fat = 5 }
        );
    }
}
