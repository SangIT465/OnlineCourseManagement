$ErrorActionPreference = 'Stop'
$projectPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'backend\OnlineCourseManagement.Api\OnlineCourseManagement.Api.csproj'
if (!(Test-Path -LiteralPath $projectPath)) { throw 'CourseFlow API project was not found.' }
if (!(Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'Install the .NET SDK first.' }

Write-Host 'Copy each value from the payOS payment channel. Input is hidden.'
Write-Host 'Paste the real keys, not DAN_..., DIEN_... or <...> example text.'
$credentials = @{}
try {
    foreach ($credentialName in @('ClientId', 'ApiKey', 'ChecksumKey')) {
        $secureInput = Read-Host "$credentialName (hidden)" -AsSecureString
        $secretPointer = [IntPtr]::Zero
        try {
            $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureInput)
            $plainInput = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer).Trim()
            if ([string]::IsNullOrWhiteSpace($plainInput) -or $plainInput -match '\s|DAN_|DIEN_|YOUR_|CLIENT_ID|API_KEY|CHECKSUM_KEY|<|>') {
                throw "$credentialName is empty or still contains example text. No keys were saved."
            }
            $credentials["PayOS:$credentialName"] = $plainInput
        }
        finally {
            if ($secretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
            $plainInput = $null
            $secureInput.Dispose()
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
