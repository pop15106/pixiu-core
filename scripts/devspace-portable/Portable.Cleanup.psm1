Set-StrictMode -Version Latest

function Remove-PortableTemporaryDirectory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$TemporaryRoot,
        [ValidateRange(1, 5)][int]$MaxAttempts = 3,
        [ValidateRange(0, 1000)][int]$DelayMilliseconds = 150
    )

    $full = [System.IO.Path]::GetFullPath($TemporaryRoot)
    $parent = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\', '/')
    $actualParent = [System.IO.Path]::GetDirectoryName($full).TrimEnd('\', '/')
    $leaf = [System.IO.Path]::GetFileName($full)
    # 僅清理本工具在系統暫存目錄建立的 GUID 目錄，不接受任意來源或安裝目錄。
    if (-not [string]::Equals($parent, $actualParent, [System.StringComparison]::OrdinalIgnoreCase) -or
        $leaf -notmatch '^pixiu-devspace-portable-[a-f0-9]{32}$') {
        return [pscustomobject]@{ Removed = $false; Attempts = 0; Path = $full; Reason = 'CLEANUP_PATH_REFUSED' }
    }
    $lastError = $null
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            if (-not (Test-Path -LiteralPath $full)) {
                return [pscustomobject]@{ Removed = $true; Attempts = ($attempt - 1); Path = $full; Reason = 'ABSENT' }
            }
            $pending = [System.Collections.Generic.Queue[string]]::new()
            $pending.Enqueue($full)
            $visited = 0
            while ($pending.Count -gt 0) {
                $item = Get-Item -LiteralPath $pending.Dequeue() -Force -ErrorAction Stop
                $visited++
                if ($visited -gt 10000 -or ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                    return [pscustomobject]@{ Removed = $false; Attempts = ($attempt - 1); Path = $full; Reason = 'CLEANUP_LINK_OR_LIMIT_REFUSED' }
                }
                if ($item.PSIsContainer) {
                    foreach ($child in @(Get-ChildItem -LiteralPath $item.FullName -Force -ErrorAction Stop)) { $pending.Enqueue($child.FullName) }
                }
            }
            Remove-Item -LiteralPath $full -Recurse -Force -ErrorAction Stop
            return [pscustomobject]@{ Removed = $true; Attempts = $attempt; Path = $full; Reason = 'REMOVED' }
        }
        catch {
            $lastError = $_.Exception.Message
            if ($attempt -lt $MaxAttempts -and $DelayMilliseconds -gt 0) { Start-Sleep -Milliseconds $DelayMilliseconds }
        }
    }
    # 回傳清理結果，不拋出清理例外去覆蓋呼叫端的主要建置錯誤。
    return [pscustomobject]@{ Removed = $false; Attempts = $MaxAttempts; Path = $full; Reason = 'RETAINED'; Error = $lastError }
}

Export-ModuleMember -Function Remove-PortableTemporaryDirectory
