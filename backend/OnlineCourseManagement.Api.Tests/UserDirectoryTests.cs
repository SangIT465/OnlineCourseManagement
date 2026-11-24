using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.DTOs.Common;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Repositories;
using OnlineCourseManagement.Security;
using OnlineCourseManagement.Services;

namespace OnlineCourseManagement.Api.Tests;

public sealed class UserDirectoryTests
{
    [Fact]
    public async Task Staff_directory_scope_overrides_a_supplied_allowed_roles_list()
    {
        await using var db = Context();
        var repository = new DirectoryRepository();
        var service = Service(db, repository);
        var input = new UserQueryParameters { AllowedRoles = [AppRoles.Admin] };
        using var cancellation = new CancellationTokenSource();

        await service.GetAllAsync(input, Actor(AppRoles.Staff), cancellation.Token);

        Assert.Equal([AppRoles.User], repository.Query!.AllowedRoles!);
        Assert.Equal(cancellation.Token, repository.Token);
    }

    [Fact]
    public async Task Admin_directory_removes_supplied_scope_and_normalizes_the_role_filter()
    {
        await using var db = Context();
        var repository = new DirectoryRepository();
        var input = new UserQueryParameters { Role = " instructor ", AllowedRoles = [AppRoles.User] };

        await Service(db, repository).GetAllAsync(input, Actor(AppRoles.Admin), default);

        Assert.Null(repository.Query!.AllowedRoles);
        Assert.Equal(AppRoles.Instructor, repository.Query.Role);
    }

    [Theory]
    [InlineData(AppRoles.Admin)]
    [InlineData(AppRoles.Staff)]
    [InlineData(AppRoles.Instructor)]
    public async Task Staff_cannot_query_privileged_roles(string role)
    {
        await using var db = Context();
        var repository = new DirectoryRepository();
        var error = await Assert.ThrowsAsync<BusinessException>(() =>
            Service(db, repository).GetAllAsync(new UserQueryParameters { Role = role }, Actor(AppRoles.Staff), default));

        Assert.Equal(BusinessError.Forbidden, error.Error);
        Assert.Null(repository.Query);
    }

    [Fact]
    public async Task Invalid_role_filter_is_rejected_before_querying_the_repository()
    {
        await using var db = Context();
        var repository = new DirectoryRepository();
        var error = await Assert.ThrowsAsync<BusinessException>(() =>
            Service(db, repository).GetAllAsync(new UserQueryParameters { Role = "Unknown" }, Actor(AppRoles.Admin), default));

        Assert.Equal(BusinessError.InvalidInput, error.Error);
        Assert.Equal("Vai trò không hợp lệ.", error.Message);
        Assert.Null(repository.Query);
    }

    [Theory]
    [InlineData(AppRoles.Admin)]
    [InlineData(AppRoles.Staff)]
    [InlineData(AppRoles.Instructor)]
    public async Task Staff_cannot_read_a_privileged_account_by_id(string role)
    {
        await using var db = Context();
        var repository = new DirectoryRepository { Account = Account(role) };
        var error = await Assert.ThrowsAsync<BusinessException>(() =>
            Service(db, repository).GetByIdAsync(42, Actor(AppRoles.Staff), default));

        Assert.Equal(BusinessError.Forbidden, error.Error);
    }

    [Fact]
    public async Task Reading_a_student_returns_public_fields_without_password_or_session_secrets()
    {
        await using var db = Context();
        var account = Account(AppRoles.User);
        var repository = new DirectoryRepository { Account = account };

        var result = await Service(db, repository).GetByIdAsync(account.Id, Actor(AppRoles.Staff), default);
        var json = JsonSerializer.Serialize(result, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.Equal(account.Email, result.Email);
        Assert.Equal(account.CreatedAt, result.CreatedAt);
        Assert.DoesNotContain(account.PasswordHash, json);
        Assert.DoesNotContain(account.SecurityStamp, json);
    }

    [Fact]
    public async Task Missing_account_keeps_the_existing_not_found_message()
    {
        await using var db = Context();
        var error = await Assert.ThrowsAsync<BusinessException>(() =>
            Service(db, new DirectoryRepository()).GetByIdAsync(42, Actor(AppRoles.Admin), default));

        Assert.Equal(BusinessError.NotFound, error.Error);
        Assert.Equal("Không tìm thấy tài khoản", error.Message);
    }

    private static AppDbContext Context() => new(new DbContextOptionsBuilder<AppDbContext>().Options);

    private static UserService Service(AppDbContext db, IUserRepository repository) =>
        new(db, repository, new PasswordHasher<User>(), TimeProvider.System);

    private static ClaimsPrincipal Actor(string role) => new(new ClaimsIdentity(
        [new(ClaimTypes.NameIdentifier, "1"), new(ClaimTypes.Role, role)], "test"));

    private static User Account(string role) => new()
    {
        Id = 42, FullName = "Học viên thử", Email = "learner@example.test", Role = role,
        PasswordHash = "private-password-hash", SecurityStamp = "private-session-secret",
        CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
    };

    private sealed class DirectoryRepository : IUserRepository
    {
        public User? Account { get; init; }
        public UserQueryParameters? Query { get; private set; }
        public CancellationToken Token { get; private set; }

        public Task<User?> GetByIdAsync(int id, CancellationToken token) => Task.FromResult(Account);

        public Task<PagedResult<User>> GetAllAsync(UserQueryParameters input, CancellationToken token)
        {
            Query = input;
            Token = token;
            return Task.FromResult(new PagedResult<User>([], 0, input.PageNumber, input.PageSize));
        }
    }
}
