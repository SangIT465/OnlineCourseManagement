using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OnlineCourseManagement.Migrations
{
    /// <inheritdoc />
    public partial class SimplifyRolesAndSecureSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Preserve account IDs, passwords, enrollments and assigned courses.
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM [Users] WHERE [Role] NOT IN
                    (N'Admin', N'Staff', N'User', N'Instructor', N'Student'))
                    THROW 51000, N'Có vai trò chưa xác định; cần kiểm tra trước khi chuyển đổi.', 1;

                UPDATE [Users]
                SET [Role] = CASE
                    WHEN [Role] IN (N'Student', N'User') THEN N'User'
                    WHEN [Role] IN (N'Instructor', N'Staff') THEN N'Staff'
                    ELSE N'Admin'
                END;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "Role",
                table: "Users",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "User",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<string>(
                name: "SecurityStamp",
                table: "Users",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValueSql: "REPLACE(CONVERT(varchar(36), NEWID()), '-', '')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Users_Role",
                table: "Users",
                sql: "[Role] IN (N'Admin', N'Staff', N'User')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Users_Role",
                table: "Users");

            migrationBuilder.Sql("""
                UPDATE [Users] SET [Role] = CASE
                    WHEN [Role] = N'User' THEN N'Student'
                    WHEN [Role] = N'Staff' THEN N'Instructor'
                    ELSE [Role]
                END;
                """);

            migrationBuilder.DropColumn(
                name: "SecurityStamp",
                table: "Users");

            migrationBuilder.AlterColumn<string>(
                name: "Role",
                table: "Users",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldDefaultValue: "User");
        }
    }
}
