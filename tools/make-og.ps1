# Генерация OG-картинки 1200x630 (assets/og.png) в стиле «научная монография»
Add-Type -AssemblyName System.Drawing

$w = 1200; $h = 630
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$paper  = [System.Drawing.ColorTranslator]::FromHtml('#FAF7F2')
$ink    = [System.Drawing.ColorTranslator]::FromHtml('#191D23')
$ink2   = [System.Drawing.ColorTranslator]::FromHtml('#4A5058')
$ink3   = [System.Drawing.ColorTranslator]::FromHtml('#666C75')
$accent = [System.Drawing.ColorTranslator]::FromHtml('#2456A6')
$accent2= [System.Drawing.ColorTranslator]::FromHtml('#B4552D')
$hair   = [System.Drawing.ColorTranslator]::FromHtml('#D8D2C6')
$grid   = [System.Drawing.ColorTranslator]::FromHtml('#EFEAE0')

$g.Clear($paper)

# миллиметровая сетка
$penGrid = New-Object System.Drawing.Pen($grid, 1)
for ($x = 0; $x -le $w; $x += 40) { $g.DrawLine($penGrid, $x, 0, $x, $h) }
for ($y = 0; $y -le $h; $y += 40) { $g.DrawLine($penGrid, 0, $y, $w, $y) }

# рамка-паспарту
$penHair = New-Object System.Drawing.Pen($hair, 2)
$g.DrawRectangle($penHair, 22, 22, $w - 44, $h - 44)

# типографика
$brushInk  = New-Object System.Drawing.SolidBrush($ink)
$brushInk2 = New-Object System.Drawing.SolidBrush($ink2)
$brushInk3 = New-Object System.Drawing.SolidBrush($ink3)
$brushAcc2 = New-Object System.Drawing.SolidBrush($accent2)

$fOver  = New-Object System.Drawing.Font('Consolas', 17, [System.Drawing.FontStyle]::Regular)
$fTitle = New-Object System.Drawing.Font('Georgia', 66, [System.Drawing.FontStyle]::Bold)
$fSub   = New-Object System.Drawing.Font('Segoe UI', 24, [System.Drawing.FontStyle]::Regular)
$fMono  = New-Object System.Drawing.Font('Consolas', 17, [System.Drawing.FontStyle]::Regular)
$fAxis  = New-Object System.Drawing.Font('Consolas', 15, [System.Drawing.FontStyle]::Regular)

$g.DrawString('01 / МЕТОДИКА МНОГОСТОРОННЕГО ИССЛЕДОВАНИЯ ЛИЧНОСТИ', $fOver, $brushInk3, 66, 62)
$g.DrawString('Психограф', $fTitle, $brushInk, 58, 96)
$g.DrawString('Онлайн-тест ММИЛ — профиль личности в T-баллах', $fSub, $brushInk2, 64, 218)
$g.DrawString('377 утверждений · 13 шкал · бесплатный график · ИИ-интерпретация', $fMono, $brushInk3, 66, 272)
$g.DrawString('демо', $fMono, $brushAcc2, 1090, 62)

# график: область x 70..1130, T 20..110 -> y 340..565
function Y([double]$t) { return 340 + (110 - $t) / 90 * 225 }
$codes = @('L','F','K','1','2','3','4','5','6','7','8','9','0')
$tvals = @(48, 52, 55, 50, 62, 54, 45, 50, 57, 68, 58, 43, 60)
$xs = 0..12 | ForEach-Object { 70 + $_ * (1060 / 12) }

# коридор нормы 30–70
$bandBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18, $accent.R, $accent.G, $accent.B))
$g.FillRectangle($bandBrush, 70, [float](Y 70), 1060, [float]((Y 30) - (Y 70)))

# медиана T=50 пунктиром
$penMid = New-Object System.Drawing.Pen($hair, 1.5)
$penMid.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$g.DrawLine($penMid, 70, [float](Y 50), 1130, [float](Y 50))

# линия профиля
$pts = @()
for ($i = 0; $i -lt 13; $i++) { $pts += New-Object System.Drawing.PointF([float]$xs[$i], [float](Y $tvals[$i])) }
$penLine = New-Object System.Drawing.Pen($accent, 5)
$penLine.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$penLine.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$penLine.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawLines($penLine, $pts)

# точки с обводкой цвета бумаги
$brushPaper = New-Object System.Drawing.SolidBrush($paper)
$brushAcc = New-Object System.Drawing.SolidBrush($accent)
foreach ($p in $pts) {
  $g.FillEllipse($brushPaper, $p.X - 10, $p.Y - 10, 20, 20)
  $g.FillEllipse($brushAcc, $p.X - 6.5, $p.Y - 6.5, 13, 13)
}

# коды шкал под осью
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Center
for ($i = 0; $i -lt 13; $i++) {
  $g.DrawString($codes[$i], $fAxis, $brushInk3, [float]$xs[$i], 578, $fmt)
}

$out = Join-Path (Split-Path $PSScriptRoot -Parent) 'assets\og.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output ("OK: " + $out + " (" + (Get-Item $out).Length + " bytes)")
