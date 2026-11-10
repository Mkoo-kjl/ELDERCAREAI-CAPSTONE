param(
    [Parameter(Mandatory = $true)]
    [string]$PdfPath,
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime

[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null

function Wait-AsyncOperation {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Operation,
        [Parameter(Mandatory = $true)]
        [type]$ResultType
    )
    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object {
            $_.Name -eq 'AsTask' -and
            $_.IsGenericMethod -and
            $_.GetParameters().Count -eq 1 -and
            $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*'
        } |
        Select-Object -First 1
    $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    $task.Wait()
    return $task.Result
}

function Wait-AsyncAction {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Action
    )
    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object {
            $_.Name -eq 'AsTask' -and
            -not $_.IsGenericMethod -and
            $_.GetParameters().Count -eq 1
        } |
        Select-Object -First 1
    $task = $method.Invoke($null, @($Action))
    $task.Wait()
}

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

$storageFile = Wait-AsyncOperation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($PdfPath)) ([Windows.Storage.StorageFile])
$pdf = Wait-AsyncOperation ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($storageFile)) ([Windows.Data.Pdf.PdfDocument])

for ($index = 0; $index -lt $pdf.PageCount; $index++) {
    $page = $pdf.GetPage($index)
    $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    try {
        Wait-AsyncAction ($page.RenderToStreamAsync($stream))
        $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
        try {
            $length = [uint32]$stream.Size
            [void](Wait-AsyncOperation ($reader.LoadAsync($length)) ([uint32]))
            $bytes = New-Object byte[] $length
            $reader.ReadBytes($bytes)
            $output = Join-Path $OutputDirectory ('page-{0:D2}.png' -f ($index + 1))
            [IO.File]::WriteAllBytes($output, $bytes)
        }
        finally {
            $reader.Dispose()
        }
    }
    finally {
        $stream.Dispose()
        $page.Dispose()
    }
}

Write-Output ("Rendered {0} pages to {1}" -f $pdf.PageCount, $OutputDirectory)
