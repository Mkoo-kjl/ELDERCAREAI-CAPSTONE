param(
    [string]$SourcePath = 'C:\Users\vence\Downloads\REVISED SYSTEM USE CASE.docx',
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\docs\REVISED_SYSTEM_USE_CASE_CLEANED.docx')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression

$source = [IO.Path]::GetFullPath($SourcePath)
$output = [IO.Path]::GetFullPath($OutputPath)

if (-not (Test-Path -LiteralPath $source)) {
    throw "Source document not found: $source"
}

$outputDirectory = Split-Path -Parent $output
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

# Copy through a shared read handle because the source may be open in Word.
$inputStream = [IO.File]::Open(
    $source,
    [IO.FileMode]::Open,
    [IO.FileAccess]::Read,
    [IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete
)
try {
    $outputStream = [IO.File]::Create($output)
    try {
        $inputStream.CopyTo($outputStream)
    }
    finally {
        $outputStream.Dispose()
    }
}
finally {
    $inputStream.Dispose()
}

$fileStream = [IO.File]::Open($output, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
try {
    $archive = [IO.Compression.ZipArchive]::new($fileStream, [IO.Compression.ZipArchiveMode]::Update, $false)
    try {
        $entry = $archive.GetEntry('word/document.xml')
        if ($null -eq $entry) {
            throw 'word/document.xml is missing from the DOCX package.'
        }

        $entryStream = $entry.Open()
        try {
            $reader = [IO.StreamReader]::new($entryStream)
            try {
                $xmlText = $reader.ReadToEnd()
            }
            finally {
                $reader.Dispose()
            }
        }
        finally {
            $entryStream.Dispose()
        }

        $xml = [Xml.XmlDocument]::new()
        $xml.PreserveWhitespace = $true
        $xml.LoadXml($xmlText)

        $namespace = [Xml.XmlNamespaceManager]::new($xml.NameTable)
        $namespace.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
        $body = $xml.SelectSingleNode('//w:body', $namespace)

        $matchingTables = @()
        foreach ($table in $body.SelectNodes('./w:tbl', $namespace)) {
            $text = (($table.SelectNodes('.//w:t', $namespace) | ForEach-Object { $_.InnerText }) -join '')
            if ($text -like '*Use Case NameView System Overview*') {
                $matchingTables += $table
            }
        }

        if ($matchingTables.Count -ne 2) {
            throw "Expected exactly two View System Overview tables, found $($matchingTables.Count)."
        }

        $duplicateTable = $matchingTables[-1]
        $duplicateText = (($duplicateTable.SelectNodes('.//w:t', $namespace) | ForEach-Object { $_.InnerText }) -join '')
        if ($duplicateText -notlike '*1. Open Overview.2. Review the available summary cards*' -or $duplicateText -like '*8.1.*') {
            throw 'The final View System Overview table does not match the older duplicate numbering pattern.'
        }

        $nodesToRemove = [System.Collections.Generic.List[Xml.XmlNode]]::new()
        $nodesToRemove.Add($duplicateTable)

        # Remove the empty paragraph immediately after the duplicate table.
        $next = $duplicateTable.NextSibling
        if ($null -ne $next -and $next.LocalName -eq 'p') {
            $nextText = (($next.SelectNodes('.//w:t', $namespace) | ForEach-Object { $_.InnerText }) -join '').Trim()
            if (-not $nextText) {
                $nodesToRemove.Add($next)
            }
        }

        # Remove the duplicate heading, description, caption, title, and its page-break paragraph.
        $expectedPrecedingText = @(
            'VIEW SYSTEM OVERVIEW',
            'Table 29',
            'The administrator reviews system summaries and recent activity before opening the relevant management page.',
            'View System Overview'
        )

        $cursor = $duplicateTable.PreviousSibling
        foreach ($expected in $expectedPrecedingText) {
            if ($null -eq $cursor -or $cursor.LocalName -ne 'p') {
                throw "Could not locate the duplicate section paragraph: $expected"
            }
            $cursorText = (($cursor.SelectNodes('.//w:t', $namespace) | ForEach-Object { $_.InnerText }) -join '').Trim()
            if ($cursorText -ne $expected) {
                throw "Unexpected duplicate section text. Expected '$expected' but found '$cursorText'."
            }
            $nodesToRemove.Add($cursor)
            $cursor = $cursor.PreviousSibling
        }

        if ($null -eq $cursor -or $cursor.LocalName -ne 'p' -or $cursor.SelectNodes('.//w:br', $namespace).Count -lt 1) {
            throw 'Could not locate the page break before the duplicate Table 29 section.'
        }
        $nodesToRemove.Add($cursor)

        foreach ($node in $nodesToRemove) {
            [void]$body.RemoveChild($node)
        }

        $entry.Delete()
        $newEntry = $archive.CreateEntry('word/document.xml', [IO.Compression.CompressionLevel]::Optimal)
        $newStream = $newEntry.Open()
        try {
            $settings = [Xml.XmlWriterSettings]::new()
            $settings.Encoding = [Text.UTF8Encoding]::new($false)
            $settings.Indent = $false
            $settings.CloseOutput = $false
            $writer = [Xml.XmlWriter]::Create($newStream, $settings)
            try {
                $xml.Save($writer)
            }
            finally {
                $writer.Dispose()
            }
        }
        finally {
            $newStream.Dispose()
        }
    }
    finally {
        $archive.Dispose()
    }
}
finally {
    $fileStream.Dispose()
}

Write-Output "Created $output"
