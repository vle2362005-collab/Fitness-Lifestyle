using FitnessLifestyle.API.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace FitnessLifestyle.API.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261108090000_AddCommunityAndHomeCatalog")]
public sealed class AddCommunityAndHomeCatalog : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE [CommunityPosts] (
                [Id] int IDENTITY NOT NULL CONSTRAINT [PK_CommunityPosts] PRIMARY KEY,
                [AuthorId] int NOT NULL, [Content] nvarchar(1500) NOT NULL,
                [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL,
                [ExerciseName] nvarchar(160) NULL, [Reps] int NULL, [DurationSeconds] float NULL,
                CONSTRAINT [FK_CommunityPosts_Users_AuthorId] FOREIGN KEY ([AuthorId]) REFERENCES [Users]([Id]) ON DELETE CASCADE
            );
            CREATE TABLE [CommunityComments] (
                [Id] int IDENTITY NOT NULL CONSTRAINT [PK_CommunityComments] PRIMARY KEY,
                [PostId] int NOT NULL, [AuthorId] int NOT NULL, [Content] nvarchar(500) NOT NULL,
                [IsSuggestion] bit NOT NULL, [CreatedAt] datetime2 NOT NULL,
                CONSTRAINT [FK_CommunityComments_CommunityPosts_PostId] FOREIGN KEY ([PostId]) REFERENCES [CommunityPosts]([Id]) ON DELETE CASCADE,
                CONSTRAINT [FK_CommunityComments_Users_AuthorId] FOREIGN KEY ([AuthorId]) REFERENCES [Users]([Id])
            );
            CREATE TABLE [CommunityLikes] (
                [PostId] int NOT NULL, [UserId] int NOT NULL,
                CONSTRAINT [PK_CommunityLikes] PRIMARY KEY ([PostId], [UserId]),
                CONSTRAINT [FK_CommunityLikes_CommunityPosts_PostId] FOREIGN KEY ([PostId]) REFERENCES [CommunityPosts]([Id]) ON DELETE CASCADE,
                CONSTRAINT [FK_CommunityLikes_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users]([Id])
            );
            CREATE INDEX [IX_CommunityPosts_AuthorId] ON [CommunityPosts]([AuthorId]);
            CREATE INDEX [IX_CommunityComments_AuthorId] ON [CommunityComments]([AuthorId]);
            CREATE INDEX [IX_CommunityComments_PostId_Id] ON [CommunityComments]([PostId], [Id]);
            CREATE INDEX [IX_CommunityLikes_UserId] ON [CommunityLikes]([UserId]);

            INSERT INTO [Exercises] ([Name], [Category], [Description], [ImageUrl], [MetValue], [CaloriesPerMinute])
            SELECT v.[Name], v.[Category], v.[Description], N'', v.[Met], v.[Cal]
            FROM (VALUES
                (N'Bird Dog', N'Back', N'Tập kiểm soát thân người ở tư thế chống bốn điểm.', 3.0, 4),
                (N'Prone W Raise', N'Back', N'Nằm sấp, nâng tay hình chữ W để tập vùng bả vai.', 3.0, 4),
                (N'Chống đẩy tường', N'Chest', N'Biến thể dễ để làm quen chuyển động đẩy.', 3.0, 4),
                (N'Chống đẩy gối', N'Chest', N'Biến thể giảm tải tập trên thảm.', 4.0, 5),
                (N'Cuốn tay trước', N'Arms', N'Gập khuỷu với chai nước nhẹ nếu phù hợp.', 3.0, 4),
                (N'Duỗi tay sau', N'Arms', N'Duỗi khuỷu với tải nhẹ có kiểm soát.', 3.0, 4),
                (N'Nâng tay ngang', N'Shoulders', N'Làm quen chuyển động vai, không cần tạ.', 3.0, 4),
                (N'Trượt tay trên tường', N'Shoulders', N'Tập kiểm soát chuyển động vai với tường.', 2.5, 3),
                (N'Đứng lên – ngồi xuống', N'Legs', N'Dùng ghế chắc làm mốc để tập đứng lên.', 3.5, 5),
                (N'Nâng hông', N'Legs', N'Bài tập vùng hông và mông khi nằm ngửa.', 3.5, 5),
                (N'Dead Bug', N'Abs', N'Tập giữ thân ổn định khi di chuyển tay và chân.', 3.0, 4),
                (N'Plank gối', N'Abs', N'Bài giữ tư thế trên thảm, theo dõi theo thời gian.', 3.0, 4)
            ) AS v([Name], [Category], [Description], [Met], [Cal])
            WHERE NOT EXISTS (SELECT 1 FROM [Exercises] AS e WHERE e.[Name] = v.[Name]);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("CommunityLikes");
        migrationBuilder.DropTable("CommunityComments");
        migrationBuilder.DropTable("CommunityPosts");
        // Preserve catalog rows that may now have dependent workout history.
    }
}
