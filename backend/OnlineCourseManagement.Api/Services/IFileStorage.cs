namespace OnlineCourseManagement.Services;

public sealed record StoredFile(string StoredName, string ContentType, long Size);

public interface IFileStorage
{
    Task<StoredFile> SaveAsync(IFormFile file, string fileType, CancellationToken token);
    string GetPath(string fileType, string storedName);
    void Delete(string fileType, string storedName);
}
