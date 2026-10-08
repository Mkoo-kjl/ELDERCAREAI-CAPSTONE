Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

$iconDirectory = Join-Path $PSScriptRoot '..\assets\nav-icons'
$pixelSize = 96

function Draw-SvgNode {
  param(
    [System.Xml.XmlNode]$Node,
    [System.Windows.Media.DrawingContext]$Context,
    [string]$Fill,
    [string]$Stroke,
    [double]$StrokeWidth,
    [string]$LineCap,
    [string]$LineJoin
  )

  if ($Node.NodeType -ne [System.Xml.XmlNodeType]::Element) { return }

  if ($Node.Attributes['fill']) { $Fill = $Node.Attributes['fill'].Value }
  if ($Node.Attributes['stroke']) { $Stroke = $Node.Attributes['stroke'].Value }
  if ($Node.Attributes['stroke-width']) { $StrokeWidth = [double]::Parse($Node.Attributes['stroke-width'].Value, [cultureinfo]::InvariantCulture) }
  if ($Node.Attributes['stroke-linecap']) { $LineCap = $Node.Attributes['stroke-linecap'].Value }
  if ($Node.Attributes['stroke-linejoin']) { $LineJoin = $Node.Attributes['stroke-linejoin'].Value }

  $geometry = $null
  if ($Node.LocalName -eq 'path' -and $Node.Attributes['d']) {
    $geometry = [System.Windows.Media.Geometry]::Parse($Node.Attributes['d'].Value)
  } elseif ($Node.LocalName -eq 'circle') {
    $x = [double]::Parse($Node.Attributes['cx'].Value, [cultureinfo]::InvariantCulture)
    $y = [double]::Parse($Node.Attributes['cy'].Value, [cultureinfo]::InvariantCulture)
    $radius = [double]::Parse($Node.Attributes['r'].Value, [cultureinfo]::InvariantCulture)
    $geometry = [System.Windows.Media.EllipseGeometry]::new([System.Windows.Point]::new($x, $y), $radius, $radius)
  }

  if ($geometry) {
    $brush = if ($Fill -eq 'none') { $null } else { [System.Windows.Media.Brushes]::Black }
    $pen = $null
    if ($Stroke -ne 'none') {
      $pen = [System.Windows.Media.Pen]::new([System.Windows.Media.Brushes]::Black, $StrokeWidth)
      if ($LineCap -eq 'round') {
        $pen.StartLineCap = [System.Windows.Media.PenLineCap]::Round
        $pen.EndLineCap = [System.Windows.Media.PenLineCap]::Round
      }
      if ($LineJoin -eq 'round') { $pen.LineJoin = [System.Windows.Media.PenLineJoin]::Round }
    }
    $Context.DrawGeometry($brush, $pen, $geometry)
  }

  foreach ($child in $Node.ChildNodes) {
    Draw-SvgNode $child $Context $Fill $Stroke $StrokeWidth $LineCap $LineJoin
  }
}

Get-ChildItem -LiteralPath $iconDirectory -Filter '*.svg' | ForEach-Object {
  [xml]$svg = Get-Content -LiteralPath $_.FullName -Raw
  $viewBox = [double[]]($svg.svg.viewBox -split '\s+' | ForEach-Object { [double]::Parse($_, [cultureinfo]::InvariantCulture) })
  $visual = [System.Windows.Media.DrawingVisual]::new()
  $context = $visual.RenderOpen()
  $context.PushTransform([System.Windows.Media.ScaleTransform]::new($pixelSize / $viewBox[2], $pixelSize / $viewBox[3]))
  $context.PushTransform([System.Windows.Media.TranslateTransform]::new(-$viewBox[0], -$viewBox[1]))
  Draw-SvgNode $svg.DocumentElement $context 'black' 'none' 1 'flat' 'miter'
  $context.Close()

  $bitmap = [System.Windows.Media.Imaging.RenderTargetBitmap]::new($pixelSize, $pixelSize, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32)
  $bitmap.Render($visual)
  $encoder = [System.Windows.Media.Imaging.PngBitmapEncoder]::new()
  $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
  $outputPath = Join-Path $iconDirectory ($_.BaseName + '.png')
  $stream = [System.IO.File]::Create($outputPath)
  try { $encoder.Save($stream) } finally { $stream.Dispose() }
}
