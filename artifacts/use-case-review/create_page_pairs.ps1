param(
    [Parameter(Mandatory = $true)]
    [string]$InputDirectory,
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

$pages = Get-ChildItem -LiteralPath $InputDirectory -Filter 'page-*.png' | Sort-Object Name
for ($index = 0; $index -lt $pages.Count; $index += 2) {
    $left = [Drawing.Image]::FromFile($pages[$index].FullName)
    $right = $null
    try {
        if (($index + 1) -lt $pages.Count) {
            $right = [Drawing.Image]::FromFile($pages[$index + 1].FullName)
        }
        $width = $left.Width + $(if ($right) { $right.Width } else { 0 })
        $height = [Math]::Max($left.Height, $(if ($right) { $right.Height } else { 0 }))
        $canvas = New-Object Drawing.Bitmap($width, $height)
        try {
            $graphics = [Drawing.Graphics]::FromImage($canvas)
            try {
                $graphics.Clear([Drawing.Color]::White)
                $graphics.DrawImageUnscaled($left, 0, 0)
                if ($right) {
                    $graphics.DrawImageUnscaled($right, $left.Width, 0)
                }
            }
            finally {
                $graphics.Dispose()
            }
            $pairNumber = [int]($index / 2) + 1
            $output = Join-Path $OutputDirectory ('pair-{0:D2}.png' -f $pairNumber)
            $canvas.Save($output, [Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $canvas.Dispose()
        }
    }
    finally {
        $left.Dispose()
        if ($right) { $right.Dispose() }
    }
}
