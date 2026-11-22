using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OnlineCourseManagement.Migrations
{
    /// <inheritdoc />
    public partial class AddInstructorRoleAndSeparateAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Users_Role",
                table: "Users");

            migrationBuilder.AddColumn<int>(
                name: "StaffId",
                table: "Courses",
                type: "int",
                nullable: true);

            // The previous schema stored operational Staff assignments in InstructorId.
            migrationBuilder.Sql("""
                UPDATE c SET c.StaffId = c.InstructorId, c.InstructorId = NULL
                FROM Courses c INNER JOIN Users u ON u.Id = c.InstructorId
                WHERE u.Role = N'Staff';
                """);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Users_Role",
                table: "Users",
                sql: "[Role] IN (N'Admin', N'Staff', N'Instructor', N'User')");

            migrationBuilder.CreateIndex(
                name: "IX_Courses_StaffId",
                table: "Courses",
                column: "StaffId");

            migrationBuilder.AddForeignKey(
                name: "FK_Courses_Users_StaffId",
                table: "Courses",
                column: "StaffId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM Users WHERE Role = N'Instructor')
                    THROW 51000, 'Reassign courses and remove Instructor roles before downgrading.', 1;
                UPDATE Courses SET InstructorId = StaffId;
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_Courses_Users_StaffId",
                table: "Courses");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Users_Role",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Courses_StaffId",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "StaffId",
                table: "Courses");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Users_Role",
                table: "Users",
                sql: "[Role] IN (N'Admin', N'Staff', N'User')");
        }
    }
}
