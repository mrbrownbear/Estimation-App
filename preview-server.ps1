Param()
$ErrorActionPreference = 'Stop'
$root = Get-Location

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8000/')
$listener.Start()
Write-Host "Serving $root at http://localhost:8000/"

function Get-ContentType($path) {
  $ext = [System.IO.Path]::GetExtension($path).ToLower()
  switch ($ext) {
    '.html' { return 'text/html' }
    '.css'  { return 'text/css' }
    '.js'   { return 'application/javascript' }
    '.json' { return 'application/json' }
    '.png'  { return 'image/png' }
    '.jpg'  { return 'image/jpeg' }
    '.jpeg' { return 'image/jpeg' }
    '.svg'  { return 'image/svg+xml' }
    default { return 'application/octet-stream' }
  }
}

while ($true) {
  $ctx = $listener.GetContext()
  $rel = $ctx.Request.Url.LocalPath.TrimStart('/')
  if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
  $full = Join-Path $root $rel
  if (Test-Path $full) {
    $bytes = [System.IO.File]::ReadAllBytes($full)
    $ctx.Response.ContentType = Get-ContentType $full
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $ctx.Response.StatusCode = 404
    $msg = [Text.Encoding]::UTF8.GetBytes("Not Found")
    $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
  }
  $ctx.Response.OutputStream.Flush()
  $ctx.Response.Close()
}