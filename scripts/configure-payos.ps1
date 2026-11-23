param([switch]$FromClipboard)

$ErrorActionPreference = 'Stop'
$projectPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'backend\OnlineCourseManagement.Api\OnlineCourseManagement.Api.csproj'
if (!(Test-Path -LiteralPath $projectPath)) { throw 'CourseFlow API project was not found.' }
if (!(Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'Install the .NET SDK first.' }

if ($FromClipboard -and !(Get-Command Get-Clipboard -ErrorAction SilentlyContinue)) {
    throw 'Clipboard access is unavailable. Use Visual Studio Manage User Secrets to enter the keys.'
}
Write-Host 'Copy each value from the payOS payment channel. Keys are never printed.'
if ($FromClipboard) {
    Write-Host 'For each prompt: copy the matching key in payOS, return here and press Enter WITHOUT pasting.'
} else {
    Write-Host 'Hidden input: use right-click or Shift+Insert to paste in Windows PowerShell. Ctrl+V may not paste.'
    Write-Host 'If pasting fails, rerun this script with -FromClipboard.'
}
Write-Host 'Paste the real keys, not DAN_..., DIEN_... or <...> example text.'
$credentials = @{}
try {
    foreach ($credentialName in @('ClientId', 'ApiKey', 'ChecksumKey')) {
        $secureInput = $null
        $secretPointer = [IntPtr]::Zero
        try {
            if ($FromClipboard) {
                $secureInput = Read-Host "Copy $credentialName in payOS, then press Enter here (do not paste)" -AsSecureString
                $plainInput = ([string](Get-Clipboard -Raw)).Trim()
            } else {
                $secureInput = Read-Host "$credentialName (hidden)" -AsSecureString
                $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureInput)
                $plainInput = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer).Trim()
            }
            $containsControl = @($plainInput.ToCharArray() | Where-Object { [char]::IsControl($_) }).Count -gt 0
            if ($plainInput.Length -lt 8 -or $containsControl) {
                throw "$credentialName is incomplete or contains a terminal shortcut. Nothing was saved. Rerun with -FromClipboard, copy the actual key in payOS, then press Enter without pasting."
            }
            if ([string]::IsNullOrWhiteSpace($plainInput) -or $plainInput -match '\s|DAN_|DIEN_|YOUR_|CLIENT_ID|API_KEY|CHECKSUM_KEY|<|>') {
                throw "$credentialName is empty or still contains example text. No keys were saved."
            }
            $credentials["PayOS:$credentialName"] = $plainInput
            Write-Host "$credentialName received: $($plainInput.Length) characters (value hidden)."
        }
        finally {
            if ($secretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
            $plainInput = $null
            if ($null -ne $secureInput) { $secureInput.Dispose() }
        }
    }
    # Piped JSON keeps keys out of command arguments and merges with existing secrets.
    $credentials | ConvertTo-Json -Compress | dotnet user-secrets set --project $projectPath
    if ($LASTEXITCODE -ne 0) { throw 'Could not save the payOS keys.' }
    Write-Host 'Saved the three payOS keys. Restart the backend, reload the order and choose Create QR.'
}
finally {
    $credentials.Clear()
}
