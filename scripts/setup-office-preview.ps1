$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$toolsRoot = Join-Path $repoRoot '.tools'
$runtimeRoot = Join-Path $toolsRoot 'libreoffice'
$executable = Join-Path $runtimeRoot 'program\soffice.com'
if (Test-Path -LiteralPath $executable) { Write-Host 'Office preview runtime is already available.'; exit 0 }
if ($env:OS -ne 'Windows_NT') { throw 'On Linux, install LibreOffice Writer, Impress and Calc, then configure DocumentPreview__ExecutablePath if needed.' }
$downloadRoot = Join-Path $toolsRoot 'downloads'
New-Item -ItemType Directory -Force -Path $downloadRoot | Out-Null
$installer = Join-Path $downloadRoot 'LibreOffice_26.8.3_Win_x86-64.msi'
$expectedHash = '0e6918c273eabbdbbd800ee0dacbbf130a14c13c2e4cec861b06dd59e015bf94'
if (!(Test-Path -LiteralPath $installer)) {
    Write-Host 'Downloading the official LibreOffice runtime. This is a one-time setup.'
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://download.documentfoundation.org/libreoffice/stable/26.8.3/win/x86_64/LibreOffice_26.8.3_Win_x86-64.msi' -OutFile $installer
}
if ((Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Installer checksum does not match the official package. Extraction was not started.' }
$resolvedRoot = [IO.Path]::GetFullPath($runtimeRoot)
if (!$resolvedRoot.StartsWith([IO.Path]::GetFullPath($toolsRoot) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected runtime target.' }
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
$arguments = @('/a', ('"' + $installer + '"'), '/qn', ('TARGETDIR="' + $runtimeRoot + '"'))
$process = Start-Process -FilePath 'msiexec.exe' -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0 -or !(Test-Path -LiteralPath $executable)) { throw 'Could not extract the runtime. Install LibreOffice and configure DocumentPreview:ExecutablePath.' }
Write-Host 'Office preview is ready. Restart the API. The runtime is stored only in this project .tools folder.'
