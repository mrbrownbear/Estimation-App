param(
  [int]$Port = 8000,
  [string]$Root = '.'
)

$ErrorActionPreference = 'Stop'

function Get-ContentType($path) {
  $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
  switch ($ext) {
    '.html' { 'text/html; charset=utf-8' }
    '.htm'  { 'text/html; charset=utf-8' }
    '.css'  { 'text/css; charset=utf-8' }
    '.js'   { 'application/javascript; charset=utf-8' }
    '.json' { 'application/json; charset=utf-8' }
    '.png'  { 'image/png' }
    '.jpg'  { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.svg'  { 'image/svg+xml' }
    default { 'application/octet-stream' }
  }
}

$rootPath = Resolve-Path -Path $Root
$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving $rootPath at $prefix" -ForegroundColor Green

try {
  while ($true) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response

    $relPath = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($relPath)) { $relPath = 'index.html' }
    $fsPath = Join-Path -Path $rootPath -ChildPath $relPath

    if (Test-Path -Path $fsPath -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($fsPath)
      $res.StatusCode = 200
      $res.ContentType = Get-ContentType $fsPath
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } elseif (Test-Path -Path (Join-Path $fsPath 'index.html')) {
      $indexPath = Join-Path $fsPath 'index.html'
      $bytes = [System.IO.File]::ReadAllBytes($indexPath)
      $res.StatusCode = 200
      $res.ContentType = 'text/html; charset=utf-8'
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = "404 Not Found: $relPath"
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    $res.Close()
  }
} finally {
  $listener.Stop()
}