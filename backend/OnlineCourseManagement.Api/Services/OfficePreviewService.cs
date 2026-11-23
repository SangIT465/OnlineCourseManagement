using System.ComponentModel;
using System.Diagnostics;
using Microsoft.Extensions.Options;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Options;

namespace OnlineCourseManagement.Services;

public interface IOfficePreviewService
{
    Task<string> GetPdfAsync(string sourcePath, CancellationToken token);
}

public sealed class OfficePreviewService(IOptions<DocumentPreviewOptions> configured,
    IOptions<FileStorageOptions> storage, IWebHostEnvironment environment, ILogger<OfficePreviewService> logger) : IOfficePreviewService
{
    // Bound the number of Office processes. Cache hits do not acquire this gate.
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private readonly string _root = Path.GetFullPath(storage.Value.RootPath, environment.ContentRootPath);

    private string Executable()
    {
        if (!string.IsNullOrWhiteSpace(configured.Value.ExecutablePath))
            return Path.GetFullPath(configured.Value.ExecutablePath, environment.ContentRootPath);
        var roots = new[] { Path.Combine(environment.ContentRootPath, ".tools", "libreoffice"),
            Path.GetFullPath("../../.tools/libreoffice", environment.ContentRootPath),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "LibreOffice"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "LibreOffice") };
        foreach (var root in roots)
            foreach (var relative in new[] { "program/soffice.exe", "program/soffice.com", "LibreOffice/program/soffice.exe", "LibreOffice/program/soffice.com" })
            {
                var candidate = Path.Combine(root, relative);
                if (File.Exists(candidate)) return candidate;
            }
        return OperatingSystem.IsWindows() ? "soffice.exe" : "soffice";
    }

    public async Task<string> GetPdfAsync(string sourcePath, CancellationToken token)
    {
        var source = Path.GetFullPath(sourcePath);
        var storedName = Path.GetFileNameWithoutExtension(source);
        if (!source.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) ||
            !Guid.TryParseExact(storedName, "N", out _) || !LearningFileFormats.IsOffice(Path.GetExtension(source).ToLowerInvariant()))
            throw BusinessException.Invalid("Tệp cần xem không hợp lệ.");
        var cache = Path.Combine(_root, ".previews", storedName + ".pdf");
        bool Cached() => File.Exists(source) && File.Exists(cache) && File.GetLastWriteTimeUtc(cache) >= File.GetLastWriteTimeUtc(source);
        if (Cached()) return cache;
        if (!await Gate.WaitAsync(TimeSpan.FromSeconds(30), token))
            throw BusinessException.Conflict("Các tài liệu khác đang được chuẩn bị. Vui lòng thử lại sau.");
        string? work = null;
        string? temporaryCache = null;
        try
        {
            if (Cached()) return cache;
            if (!File.Exists(source)) throw BusinessException.NotFound("Tệp không còn tồn tại.");
            // Keep Office's deeply nested profile below Windows path limits.
            // The uploaded original and cached PDF remain in private file storage.
            var workRoot = Path.Combine(Path.GetTempPath(), "cf-office");
            work = Path.Combine(workRoot, Guid.NewGuid().ToString("N"));
            var profile = Path.Combine(work, "profile");
            var output = Path.Combine(work, "output");
            Directory.CreateDirectory(Path.Combine(profile, "user"));
            Directory.CreateDirectory(output);
            await File.WriteAllTextAsync(Path.Combine(profile, "user", "registrymodifications.xcu"), SafeProfile, token);
            var input = Path.Combine(work, "source" + Path.GetExtension(source));
            File.Copy(source, input);
            var start = new ProcessStartInfo(Executable())
            {
                UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardOutput = true, RedirectStandardError = true, WorkingDirectory = work
            };
            foreach (var argument in new[] { "-env:UserInstallation=" + new Uri(profile + Path.DirectorySeparatorChar).AbsoluteUri,
                "--headless", "--nologo", "--nodefault", "--norestore", "--nolockcheck", "--convert-to", "pdf", "--outdir", output, input })
                start.ArgumentList.Add(argument);
            using var process = new Process { StartInfo = start };
            try { process.Start(); }
            catch (Win32Exception)
            { throw BusinessException.Conflict("Chưa mở được tài liệu Office trên máy chủ. Bạn vẫn có thể tải bản gốc xuống."); }
            var stdout = process.StandardOutput.ReadToEndAsync();
            var stderr = process.StandardError.ReadToEndAsync();
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token);
            deadline.CancelAfter(TimeSpan.FromSeconds(configured.Value.TimeoutSeconds));
            try
            {
                await process.WaitForExitAsync(deadline.Token);
                await Task.WhenAll(stdout, stderr);
            }
            catch (OperationCanceledException)
            {
                if (!process.HasExited) process.Kill(entireProcessTree: true);
                await process.WaitForExitAsync(CancellationToken.None);
                if (token.IsCancellationRequested) throw;
                throw BusinessException.Conflict("Tài liệu mất quá lâu để mở hoặc cần mật khẩu. Bạn có thể tải bản gốc xuống.");
            }
            var pdfPath = Path.Combine(output, "source.pdf");
            if (process.ExitCode != 0 || !File.Exists(pdfPath) || new FileInfo(pdfPath).Length > 100_000_000)
            {
                var detail = ((await stdout) + " " + (await stderr)).Replace(work, "[preview]");
                logger.LogWarning("Office preview failed for {StoredName}; exit {ExitCode}; {Detail}", storedName, process.ExitCode,
                    detail.Length > 800 ? detail[..800] : detail);
                throw BusinessException.Invalid("Chưa tạo được bản xem. Tệp có thể bị hỏng hoặc cần mật khẩu; bạn vẫn có thể tải bản gốc.");
            }
            var header = new byte[5];
            await using (var check = File.OpenRead(pdfPath))
                if (await check.ReadAsync(header, token) != 5 || !header.AsSpan().SequenceEqual("%PDF-"u8))
                    throw BusinessException.Invalid("Bản xem tài liệu không hợp lệ.");
            if (!File.Exists(source)) throw BusinessException.NotFound("Tệp đã bị xóa.");
            Directory.CreateDirectory(Path.GetDirectoryName(cache)!);
            // Temp and storage may be on different drives. Copy beside the destination,
            // then rename atomically so another reader never sees a partially copied PDF.
            temporaryCache = cache + "." + Guid.NewGuid().ToString("N") + ".tmp";
            File.Copy(pdfPath, temporaryCache);
            File.Move(temporaryCache, cache, overwrite: true);
            temporaryCache = null;
            return cache;
        }
        finally
        {
            if (temporaryCache is not null && File.Exists(temporaryCache)) File.Delete(temporaryCache);
            if (work is not null)
            {
                var expectedRoot = Path.GetFullPath(Path.Combine(Path.GetTempPath(), "cf-office")) + Path.DirectorySeparatorChar;
                if (!Path.GetFullPath(work).StartsWith(expectedRoot, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("Unsafe preview cleanup path.");
                try { Directory.Delete(work, recursive: true); }
                catch (IOException) { logger.LogWarning("Preview workspace cleanup deferred"); }
                catch (UnauthorizedAccessException) { logger.LogWarning("Preview workspace cleanup deferred"); }
            }
            Gate.Release();
        }
    }

    // Each conversion uses a fresh profile: no macros, active embedded objects or DDE.
    private const string SafeProfile = """
        <?xml version="1.0" encoding="UTF-8"?>
        <oor:items xmlns:oor="http://openoffice.org/2001/registry">
          <item oor:path="/org.openoffice.Office.Common/Security/Scripting">
            <prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop>
            <prop oor:name="DisableActiveContent" oor:op="fuse"><value>true</value></prop>
            <prop oor:name="BlockUntrustedRefererLinks" oor:op="fuse"><value>true</value></prop>
            <prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop>
          </item>
        </oor:items>
        """;
}
