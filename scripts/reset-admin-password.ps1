$ErrorActionPreference = 'Stop'

$projectUrl = 'https://iuhulbsgsmpezpmegeis.supabase.co'
$expectedEmail = 'jaweplanos22+eldercareadmin@gmail.com'

Write-Host 'Use a newly created secret key. Rotate the key shown in the screenshot before continuing.'
$adminIdInput = Read-Host "Paste the UUID for $expectedEmail from Authentication > Users"
$adminId = [guid]::Empty
if (-not [guid]::TryParse($adminIdInput, [ref]$adminId)) {
    throw 'That is not a valid user UUID. No password was changed.'
}

try {
    $secureKey = Read-Host 'Paste the NEW Supabase secret key (hidden input)' -AsSecureString
    $securePassword = Read-Host 'New admin password (hidden input)' -AsSecureString
    $secureConfirmation = Read-Host 'Confirm new admin password (hidden input)' -AsSecureString

    $key = [System.Net.NetworkCredential]::new('', $secureKey).Password
    $password = [System.Net.NetworkCredential]::new('', $securePassword).Password
    $confirmation = [System.Net.NetworkCredential]::new('', $secureConfirmation).Password

    if (-not $key.StartsWith('sb_secret_')) {
        throw 'Use a new sb_secret_ key from Settings > API Keys. No password was changed.'
    }
    if ($password.Length -lt 12 -or $password -ne $confirmation) {
        throw 'Passwords must match and be at least 12 characters. No password was changed.'
    }

    $url = "$projectUrl/auth/v1/admin/users/$adminId"
    $headers = @{ apikey = $key }
    $userAgent = 'ElderCareAI-AdminReset/1.0'
    $user = Invoke-RestMethod -Method Get -Uri $url -Headers $headers -UserAgent $userAgent
    if ($user.email -cne $expectedEmail) {
        throw 'The UUID belongs to a different user. No password was changed.'
    }

    if ((Read-Host "Type RESET to change the password for $expectedEmail") -cne 'RESET') {
        Write-Host 'Cancelled. No password was changed.'
        return
    }

    $body = @{ password = $password } | ConvertTo-Json -Compress
    $updated = Invoke-RestMethod -Method Put -Uri $url -Headers $headers -UserAgent $userAgent -ContentType 'application/json' -Body $body
    if ([string]$updated.id -ne [string]$adminId) {
        throw 'Supabase returned an unexpected account. Check Authentication > Users before signing in.'
    }
    Write-Host "Password updated for $expectedEmail. Sign in at https://eldercareai.vercel.app/edcadmin/."
}
finally {
    Remove-Variable key, password, confirmation, body, headers, secureKey, securePassword, secureConfirmation -ErrorAction SilentlyContinue
}
