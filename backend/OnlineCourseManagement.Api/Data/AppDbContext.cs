using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Security;

namespace OnlineCourseManagement.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(
            DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        public DbSet<Category> Categories { get; set; }
        public DbSet<Course> Courses { get; set; }
        public DbSet<Lesson> Lessons { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<Enrollment> Enrollments { get; set; }
        public DbSet<LessonProgress> LessonProgresses { get; set; }
        public DbSet<UploadedFile> UploadedFiles { get; set; }
        public DbSet<CoursePurchase> CoursePurchases { get; set; }

        protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
        {
            base.ConfigureConventions(configurationBuilder);
            configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        }

        protected override void OnModelCreating(
            ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<CoursePurchase>(entity =>
            {
                entity.HasIndex(p => p.OrderCode).IsUnique();
                entity.HasIndex(p => new { p.StudentId, p.CourseId }).IsUnique()
                    .HasFilter("[Status] = N'PendingPayment'");
                entity.HasOne(p => p.Student).WithMany().HasForeignKey(p => p.StudentId).OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(p => p.Course).WithMany().HasForeignKey(p => p.CourseId).OnDelete(DeleteBehavior.Restrict);
                entity.Property(p => p.OriginalPrice).HasColumnType("decimal(18,2)");
                entity.ToTable(table =>
                {
                    table.HasCheckConstraint("CK_CoursePurchases_Amount", "[Amount] >= 0");
                    table.HasCheckConstraint("CK_CoursePurchases_Status", "[Status] IN (N'PendingPayment', N'Paid', N'Cancelled', N'Expired')");
                });
            });

            modelBuilder.Entity<Category>().HasIndex(category => category.Name).IsUnique();
            modelBuilder.Entity<Lesson>().HasIndex(lesson => new { lesson.CourseId, lesson.OrderIndex }).IsUnique();

            modelBuilder.Entity<Course>()
                .HasOne(c => c.Category)
                .WithMany()
                .HasForeignKey(c => c.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Lesson>()
                .HasOne(l => l.Course)
                .WithMany()
                .HasForeignKey(l => l.CourseId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();
            modelBuilder.Entity<User>().Property(u => u.Role)
                .HasDefaultValue(AppRoles.User);
            modelBuilder.Entity<User>().Property(u => u.SecurityStamp)
                .HasDefaultValueSql("REPLACE(CONVERT(varchar(36), NEWID()), '-', '')");
            modelBuilder.Entity<User>().ToTable(table => table.HasCheckConstraint(
                "CK_Users_Role", "[Role] IN (N'Admin', N'Staff', N'Instructor', N'User')"));
            modelBuilder.Entity<Course>()
                .HasOne(c => c.Instructor)
                .WithMany()
                .HasForeignKey(c => c.InstructorId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Course>()
                .HasOne(c => c.Staff)
                .WithMany()
                .HasForeignKey(c => c.StaffId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Enrollment>(entity =>
            {
                entity.HasIndex(e => new
                {
                    e.StudentId,
                    e.CourseId
                }).IsUnique();

                entity.HasOne(e => e.Student)
                    .WithMany()
                    .HasForeignKey(e => e.StudentId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Course)
                    .WithMany()
                    .HasForeignKey(e => e.CourseId)
                    .OnDelete(DeleteBehavior.Restrict);
            });
            modelBuilder.Entity<LessonProgress>(entity =>
            {
                // Không tạo hai bản ghi cho cùng bài học
                entity.HasIndex(p => new
                {
                    p.EnrollmentId,
                    p.LessonId
                }).IsUnique();

                entity.HasOne(p => p.Enrollment)
                    .WithMany()
                    .HasForeignKey(p => p.EnrollmentId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(p => p.Lesson)
                    .WithMany()
                    .HasForeignKey(p => p.LessonId)
                    .OnDelete(DeleteBehavior.Restrict);
            });
            modelBuilder.Entity<UploadedFile>(entity =>
            {
                entity.HasOne(f => f.Course)
                    .WithMany()
                    .HasForeignKey(f => f.CourseId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(f => f.Lesson)
                    .WithMany()
                    .HasForeignKey(f => f.LessonId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne<User>()
                    .WithMany()
                    .HasForeignKey(f => f.UploadedById)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(f => new
                {
                    f.CourseId,
                    f.FileType
                });
            });
        }
    }
}
