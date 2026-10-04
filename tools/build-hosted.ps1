$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputPath = Join-Path $projectRoot 'dist/YINK-hosted.zip'
New-Item -ItemType Directory -Path (Split-Path $outputPath -Parent) -Force | Out-Null
$files = @(
    Get-Item -LiteralPath (Join-Path $projectRoot 'index.html')
    foreach ($directory in @('css', 'js', 'assets', 'examples')) {
        Get-ChildItem -LiteralPath (Join-Path $projectRoot $directory) -Recurse -File
    }
    foreach ($file in @('LICENSE', 'THIRD_PARTY_NOTICES.md', 'server/app.py', 'server/admin.html', 'server/privacy.html', 'deploy/nginx.conf', 'deploy/yink.service', 'deploy/README.md')) {
        Get-Item -LiteralPath (Join-Path $projectRoot $file)
    }
) | Sort-Object FullName
$stream = [System.IO.File]::Open($outputPath, [System.IO.FileMode]::Create)
try {
    $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create, $true)
    try {
        foreach ($file in $files) {
            $relative = $file.FullName.Substring($projectRoot.Length).TrimStart('\','/').Replace('\','/')
            $name = if ($relative.StartsWith('server/') -or $relative.StartsWith('deploy/')) { $relative } else { 'public/' + $relative }
            $entry = $archive.CreateEntry($name, [System.IO.Compression.CompressionLevel]::Optimal)
            $inputStream = [System.IO.File]::OpenRead($file.FullName)
            $entryStream = $entry.Open()
            try { $inputStream.CopyTo($entryStream) } finally { $entryStream.Dispose(); $inputStream.Dispose() }
        }
    } finally { $archive.Dispose() }
} finally { $stream.Dispose() }
$archive = [System.IO.Compression.ZipFile]::OpenRead($outputPath)
try {
    if ($archive.Entries.Count -ne $files.Count) { throw 'Package count mismatch' }
    foreach ($entry in $archive.Entries) {
        if ($entry.FullName -match '(server/data/|sqlite|setup-token|__pycache__|\.env|tests/)') { throw 'Unexpected private/test file' }
    }
} finally { $archive.Dispose() }
Get-Item -LiteralPath $outputPath | Select-Object FullName, Length
Get-FileHash -LiteralPath $outputPath -Algorithm SHA256
