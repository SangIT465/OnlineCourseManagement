using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Models;

namespace OnlineCourseManagement.Data;

internal static class AccountWriteLock
{
    // Acquire the same update lock before role/password changes and assignments.
    // It prevents two readers from later deadlocking while upgrading to write locks.
    public static Task<User?> FindForUpdateAsync(this AppDbContext db, int id, CancellationToken token = default)
    {
        if (db.Database.CurrentTransaction is null)
            throw new InvalidOperationException("Account write locks require an active transaction.");
        return db.Users.FromSqlInterpolated($"SELECT * FROM [dbo].[Users] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {id}")
            .SingleOrDefaultAsync(token);
    }
}
