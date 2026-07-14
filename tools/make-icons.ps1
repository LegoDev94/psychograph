# Генерация PWA-иконок из фирменного знака (бумага + линия профиля)
Add-Type -AssemblyName System.Drawing

function New-Icon([int]$size, [string]$out, [double]$pad) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  $paper = [System.Drawing.ColorTranslator]::FromHtml('#FAF7F2')
  $ink = [System.Drawing.ColorTranslator]::FromHtml('#191D23')
  $accent = [System.Drawing.ColorTranslator]::FromHtml('#2456A6')

  # скруглённый квадрат-подложка
  $r = $size * 0.18
  $rect = New-Object System.Drawing.Drawing2D.GraphicsPath
  $rect.AddArc(0, 0, $r * 2, $r * 2, 180, 90)
  $rect.AddArc($size - $r * 2, 0, $r * 2, $r * 2, 270, 90)
  $rect.AddArc($size - $r * 2, $size - $r * 2, $r * 2, $r * 2, 0, 90)
  $rect.AddArc(0, $size - $r * 2, $r * 2, $r * 2, 90, 90)
  $rect.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush($paper)), $rect)

  # тонкая рамка
  $penFrame = New-Object System.Drawing.Pen($ink, [Math]::Max(2, $size * 0.02))
  $inset = $size * 0.06
  $g.DrawRectangle($penFrame, [float]$inset, [float]$inset, [float]($size - 2 * $inset), [float]($size - 2 * $inset))

  # линия профиля (как в favicon)
  $w = $size * (1 - 2 * $pad)
  $o = $size * $pad
  $pts = @(
    (New-Object System.Drawing.PointF([float]($o + $w * 0.00), [float]($o + $w * 0.72))),
    (New-Object System.Drawing.PointF([float]($o + $w * 0.20), [float]($o + $w * 0.38))),
    (New-Object System.Drawing.PointF([float]($o + $w * 0.40), [float]($o + $w * 0.58))),
    (New-Object System.Drawing.PointF([float]($o + $w * 0.60), [float]($o + $w * 0.20))),
    (New-Object System.Drawing.PointF([float]($o + $w * 0.80), [float]($o + $w * 0.50))),
    (New-Object System.Drawing.PointF([float]($o + $w * 1.00), [float]($o + $w * 0.34)))
  )
  $pen = New-Object System.Drawing.Pen($accent, [Math]::Max(4, $size * 0.075))
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLines($pen, $pts)

  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output ("OK: " + $out)
}

$dir = Join-Path (Split-Path $PSScriptRoot -Parent) 'assets\icons'
New-Item -ItemType Directory -Force $dir | Out-Null
New-Icon 192 (Join-Path $dir 'icon-192.png') 0.24
New-Icon 512 (Join-Path $dir 'icon-512.png') 0.24
New-Icon 512 (Join-Path $dir 'icon-maskable-512.png') 0.32
New-Icon 180 (Join-Path $dir 'apple-touch-icon.png') 0.24
