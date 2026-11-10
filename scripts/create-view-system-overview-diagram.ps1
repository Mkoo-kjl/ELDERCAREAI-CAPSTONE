param(
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\docs\VIEW_SYSTEM_OVERVIEW_USE_CASE.png')
)

Add-Type -AssemblyName System.Drawing

$width = 1600
$height = 900
$bitmap = [System.Drawing.Bitmap]::new($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

try {
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $black = [System.Drawing.Color]::FromArgb(24, 24, 24)
    $linePen = [System.Drawing.Pen]::new($black, 3)
    $actorPen = [System.Drawing.Pen]::new($black, 4)
    $dependencyPen = [System.Drawing.Pen]::new($black, 2.5)
    $dependencyPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $textBrush = [System.Drawing.SolidBrush]::new($black)
    $titleFont = [System.Drawing.Font]::new('Times New Roman', 28, [System.Drawing.FontStyle]::Regular)
    $useCaseFont = [System.Drawing.Font]::new('Times New Roman', 25, [System.Drawing.FontStyle]::Regular)
    $smallUseCaseFont = [System.Drawing.Font]::new('Times New Roman', 22, [System.Drawing.FontStyle]::Regular)
    $relationFont = [System.Drawing.Font]::new('Times New Roman', 18, [System.Drawing.FontStyle]::Regular)
    $actorFont = [System.Drawing.Font]::new('Times New Roman', 25, [System.Drawing.FontStyle]::Regular)
    $centerFormat = [System.Drawing.StringFormat]::new()
    $centerFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $centerFormat.LineAlignment = [System.Drawing.StringAlignment]::Center

    function Draw-UseCase {
        param(
            [System.Drawing.Graphics]$Canvas,
            [System.Drawing.Pen]$Pen,
            [System.Drawing.Brush]$Fill,
            [System.Drawing.Brush]$TextBrush,
            [System.Drawing.Font]$Font,
            [System.Drawing.StringFormat]$Format,
            [float]$X,
            [float]$Y,
            [float]$Width,
            [float]$Height,
            [string]$Text
        )

        $rect = [System.Drawing.RectangleF]::new($X, $Y, $Width, $Height)
        $Canvas.FillEllipse($Fill, $rect)
        $Canvas.DrawEllipse($Pen, $rect)
        $Canvas.DrawString($Text, $Font, $TextBrush, $rect, $Format)
    }

    function Draw-Dependency {
        param(
            [System.Drawing.Graphics]$Canvas,
            [System.Drawing.Pen]$Pen,
            [System.Drawing.Pen]$ArrowPen,
            [System.Drawing.Brush]$TextBrush,
            [System.Drawing.Font]$Font,
            [System.Drawing.StringFormat]$Format,
            [float]$StartX,
            [float]$StartY,
            [float]$EndX,
            [float]$EndY,
            [float]$LabelX,
            [float]$LabelY,
            [string]$Label
        )

        $Canvas.DrawLine($Pen, $StartX, $StartY, $EndX, $EndY)

        $angle = [Math]::Atan2($EndY - $StartY, $EndX - $StartX)
        $arrowLength = 16
        $spread = 0.55
        $leftX = $EndX - ($arrowLength * [Math]::Cos($angle - $spread))
        $leftY = $EndY - ($arrowLength * [Math]::Sin($angle - $spread))
        $rightX = $EndX - ($arrowLength * [Math]::Cos($angle + $spread))
        $rightY = $EndY - ($arrowLength * [Math]::Sin($angle + $spread))
        $Canvas.DrawLine($ArrowPen, $EndX, $EndY, $leftX, $leftY)
        $Canvas.DrawLine($ArrowPen, $EndX, $EndY, $rightX, $rightY)

        $labelRect = [System.Drawing.RectangleF]::new($LabelX - 75, $LabelY - 18, 150, 36)
        $Canvas.FillRectangle($whiteBrush, $labelRect)
        $Canvas.DrawString($Label, $Font, $TextBrush, $labelRect, $Format)
    }

    # ElderCareAI system boundary.
    $graphics.DrawRectangle($linePen, 285, 55, 1255, 790)
    $titleRect = [System.Drawing.RectangleF]::new(285, 66, 1255, 48)
    $graphics.DrawString('ElderCareAI', $titleFont, $textBrush, $titleRect, $centerFormat)

    # Administrator stick actor.
    $graphics.DrawEllipse($actorPen, 111, 272, 48, 48)
    $graphics.DrawLine($actorPen, 135, 320, 135, 410)
    $graphics.DrawLine($actorPen, 84, 350, 186, 350)
    $graphics.DrawLine($actorPen, 135, 410, 91, 474)
    $graphics.DrawLine($actorPen, 135, 410, 179, 474)
    $actorLabel = [System.Drawing.RectangleF]::new(35, 485, 200, 45)
    $graphics.DrawString('Admin', $actorFont, $textBrush, $actorLabel, $centerFormat)

    # Main actor association.
    $graphics.DrawLine($linePen, 186, 350, 350, 230)

    # Use cases.
    Draw-UseCase $graphics $linePen $whiteBrush $textBrush $useCaseFont $centerFormat 350 180 340 100 "View System`nOverview"
    Draw-UseCase $graphics $linePen $whiteBrush $textBrush $useCaseFont $centerFormat 1020 125 350 88 'Load Current Summaries'
    Draw-UseCase $graphics $linePen $whiteBrush $textBrush $useCaseFont $centerFormat 830 300 350 88 'View Recent Activity'
    Draw-UseCase $graphics $linePen $whiteBrush $textBrush $useCaseFont $centerFormat 350 415 340 88 'Refresh Overview'
    Draw-UseCase $graphics $linePen $whiteBrush $textBrush $smallUseCaseFont $centerFormat 1020 455 350 88 "Display Zero Counts`nor Empty States"
    Draw-UseCase $graphics $linePen $whiteBrush $textBrush $smallUseCaseFont $centerFormat 930 665 390 100 "Open Selected`nManagement Page"
    Draw-UseCase $graphics $linePen $whiteBrush $textBrush $smallUseCaseFont $centerFormat 350 655 360 105 "Preserve Last Data`nand Show Error"

    # Included behavior.
    Draw-Dependency $graphics $dependencyPen $linePen $textBrush $relationFont $centerFormat 690 205 1020 169 850 158 '<<Include>>'
    Draw-Dependency $graphics $dependencyPen $linePen $textBrush $relationFont $centerFormat 690 247 830 333 760 272 '<<Include>>'

    # Optional, conditional, and follow-on behavior.
    Draw-Dependency $graphics $dependencyPen $linePen $textBrush $relationFont $centerFormat 520 415 520 280 580 350 '<<Extend>>'
    Draw-Dependency $graphics $dependencyPen $linePen $textBrush $relationFont $centerFormat 1195 455 1195 213 1280 415 '<<Extend>>'
    Draw-Dependency $graphics $dependencyPen $linePen $textBrush $relationFont $centerFormat 520 655 520 503 590 580 '<<Extend>>'
    Draw-Dependency $graphics $dependencyPen $linePen $textBrush $relationFont $centerFormat 930 705 650 260 802 485 '<<Extend>>'

    $outputDirectory = Split-Path -Parent $OutputPath
    if (-not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    }

    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
    $centerFormat.Dispose()
    $actorFont.Dispose()
    $relationFont.Dispose()
    $smallUseCaseFont.Dispose()
    $useCaseFont.Dispose()
    $titleFont.Dispose()
    $textBrush.Dispose()
    $whiteBrush.Dispose()
    $dependencyPen.Dispose()
    $actorPen.Dispose()
    $linePen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

Write-Output "Created $OutputPath"
