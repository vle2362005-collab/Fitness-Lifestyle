using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessLifestyle.API.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkoutAnalysisTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WorkoutAnalyses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    ExerciseId = table.Column<int>(type: "int", nullable: false),
                    WorkoutSessionId = table.Column<int>(type: "int", nullable: true),
                    AnalysisType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    VideoName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    VideoUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TotalReps = table.Column<int>(type: "int", nullable: false),
                    TotalSets = table.Column<int>(type: "int", nullable: false),
                    DurationInSeconds = table.Column<double>(type: "float", nullable: false),
                    CaloriesBurned = table.Column<double>(type: "float", nullable: false),
                    AccuracyScore = table.Column<double>(type: "float", nullable: false),
                    FeedbackSummary = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DetectedErrorsJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RawResultJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExerciseId1 = table.Column<int>(type: "int", nullable: true),
                    UserId1 = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkoutAnalyses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkoutAnalyses_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WorkoutAnalyses_Exercises_ExerciseId1",
                        column: x => x.ExerciseId1,
                        principalTable: "Exercises",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_WorkoutAnalyses_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WorkoutAnalyses_Users_UserId1",
                        column: x => x.UserId1,
                        principalTable: "Users",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_WorkoutAnalyses_WorkoutSessions_WorkoutSessionId",
                        column: x => x.WorkoutSessionId,
                        principalTable: "WorkoutSessions",
                        principalColumn: "Id");
                });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "AiConfig", "CaloriesPerMinute" },
                values: new object[] { "{\"mode\":\"angle\",\"metricName\":\"Góc đầu gối\",\"points\":[\"left_hip\",\"left_knee\",\"left_ankle\"],\"minScore\":0.4,\"downRule\":{\"operator\":\"<\",\"value\":100,\"feedback\":\"Đùi đã song song! Đứng lên!\"},\"upRule\":{\"operator\":\">\",\"value\":160},\"missingFeedback\":\"Vui lòng đứng xa camera để AI thấy hông, gối và cổ chân!\",\"warningFeedback\":\"Ngồi sâu xuống nữa!\"}", 8 });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "AiConfig", "CaloriesPerMinute" },
                values: new object[] { "{\"mode\":\"angle\",\"metricName\":\"Góc khuỷu tay\",\"points\":[\"left_shoulder\",\"left_elbow\",\"left_wrist\"],\"minScore\":0.4,\"downRule\":{\"operator\":\"<\",\"value\":90,\"feedback\":\"Góc đẹp! Đẩy mạnh lên!\"},\"upRule\":{\"operator\":\">\",\"value\":150},\"missingFeedback\":\"Vui lòng quay ngang người để AI thấy cánh tay!\",\"warningFeedback\":\"Hạ khuỷu tay xuống nữa!\"}", 9 });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "AiConfig", "CaloriesPerMinute" },
                values: new object[] { "{\"mode\":\"vertical\",\"point\":\"nose\",\"minScore\":0.5,\"threshold\":40,\"missingFeedback\":\"AI chưa thấy rõ khuôn mặt!\",\"downFeedback\":\"Tốt! Tiếp tục giữ nhịp.\",\"upFeedback\":\"Hoàn thành một nhịp!\"}", 4 });

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutAnalyses_ExerciseId",
                table: "WorkoutAnalyses",
                column: "ExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutAnalyses_ExerciseId1",
                table: "WorkoutAnalyses",
                column: "ExerciseId1");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutAnalyses_UserId",
                table: "WorkoutAnalyses",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutAnalyses_UserId1",
                table: "WorkoutAnalyses",
                column: "UserId1");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutAnalyses_WorkoutSessionId",
                table: "WorkoutAnalyses",
                column: "WorkoutSessionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WorkoutAnalyses");

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "AiConfig", "CaloriesPerMinute" },
                values: new object[] { null, 0 });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "AiConfig", "CaloriesPerMinute" },
                values: new object[] { null, 0 });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "AiConfig", "CaloriesPerMinute" },
                values: new object[] { null, 0 });
        }
    }
}
