$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputDirectory = Join-Path $projectRoot 'dist'
$outputPath = Join-Path $outputDirectory 'YINK-offline.zip'

function Get-ArchiveName($filePath) {
    return 'YINK/' + $filePath.Substring($projectRoot.Length).TrimStart('\', '/').Replace('\', '/')
}

$files = @(
    Get-Item -LiteralPath (Join-Path $projectRoot 'index.html')
    Get-Item -LiteralPath (Join-Path $projectRoot 'README.md')
    Get-Item -LiteralPath (Join-Path $projectRoot 'README.en.md')
    Get-Item -LiteralPath (Join-Path $projectRoot 'ACKNOWLEDGEMENTS.md')
    Get-Item -LiteralPath (Join-Path $projectRoot 'LICENSE')
    Get-Item -LiteralPath (Join-Path $projectRoot 'THIRD_PARTY_NOTICES.md')
    Get-Item -LiteralPath (Join-Path $projectRoot 'CONTRIBUTING.md')
    Get-Item -LiteralPath (Join-Path $projectRoot 'deploy/README.md')
    foreach ($directory in @('css', 'js', 'assets', 'examples', 'docs')) {
        Get-ChildItem -LiteralPath (Join-Path $projectRoot $directory) -Recurse -File
    }
) | Sort-Object FullName

if (-not $files.Count) { throw 'No files to package.' }
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

$stream = [System.IO.File]::Open($outputPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
try {
    $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create, $true)
    try {
        foreach ($file in $files) {
            $entry = $archive.CreateEntry((Get-ArchiveName $file.FullName), [System.IO.Compression.CompressionLevel]::Optimal)
            $entry.LastWriteTime = [System.DateTimeOffset]::new(2026, 1, 1, 0, 0, 0, [System.TimeSpan]::Zero)
            $source = [System.IO.File]::OpenRead($file.FullName)
            $destination = $entry.Open()
            try { $source.CopyTo($destination) }
            finally { $destination.Dispose(); $source.Dispose() }
        }
    } finally { $archive.Dispose() }
} finally { $stream.Dispose() }

$archive = [System.IO.Compression.ZipFile]::OpenRead($outputPath)
try {
    $expected = @($files | ForEach-Object { Get-ArchiveName $_.FullName })
    $actual = @($archive.Entries | ForEach-Object FullName)
    if (@(Compare-Object $expected $actual).Count) { throw 'Archive file list differs from source files.' }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        foreach ($file in $files) {
            $name = Get-ArchiveName $file.FullName
            $entry = $archive.GetEntry($name)
            $source = [System.IO.File]::OpenRead($file.FullName)
            $packed = $entry.Open()
            try {
                $sourceHash = [System.BitConverter]::ToString($sha.ComputeHash($source))
                $packedHash = [System.BitConverter]::ToString($sha.ComputeHash($packed))
                if ($sourceHash -ne $packedHash) { throw "Archive content mismatch: $name" }
            } finally { $packed.Dispose(); $source.Dispose() }
        }
    } finally { $sha.Dispose() }
} finally { $archive.Dispose() }

Write-Output "Archive built and verified: $outputPath ($($files.Count) files)"
