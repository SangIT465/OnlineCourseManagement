using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OnlineCourseManagement.Migrations
{
    /// <inheritdoc />
    public partial class AddCoursePurchases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CoursePurchases",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrderCode = table.Column<long>(type: "bigint", nullable: false),
                    StudentId = table.Column<int>(type: "int", nullable: false),
                    CourseId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    OriginalPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Amount = table.Column<int>(type: "int", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    CourseTitle = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CategoryName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    BuyerName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    BuyerEmail = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    BuyerPhone = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    BuyerAddress = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    SellerName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    SellerAddress = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    SellerContact = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PaymentLinkId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CheckoutUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    QrPayload = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    BankName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    BankAccountName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    BankAccountNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    PaymentReference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PaidAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoursePurchases", x => x.Id);
                    table.CheckConstraint("CK_CoursePurchases_Amount", "[Amount] >= 0");
                    table.CheckConstraint("CK_CoursePurchases_Status", "[Status] IN (N'PendingPayment', N'Paid', N'Cancelled', N'Expired')");
                    table.ForeignKey(
                        name: "FK_CoursePurchases_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CoursePurchases_Users_StudentId",
                        column: x => x.StudentId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CoursePurchases_CourseId",
                table: "CoursePurchases",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_CoursePurchases_OrderCode",
                table: "CoursePurchases",
                column: "OrderCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CoursePurchases_StudentId_CourseId",
                table: "CoursePurchases",
                columns: new[] { "StudentId", "CourseId" },
                unique: true,
                filter: "[Status] = N'PendingPayment'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CoursePurchases");
        }
    }
}
