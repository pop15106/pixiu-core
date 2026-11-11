$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$modulePath = Join-Path (Split-Path -Parent $PSScriptRoot) 'DevSpace.OneClick.Subagents.psm1'
$module = Import-Module $modulePath -Force -PassThru
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ('pixiu-stop-guard-' + [guid]::NewGuid().ToString('N'))
$passed = 0
try {
    [void][System.IO.Directory]::CreateDirectory((Join-Path $temp 'dist'))
    $cli = Join-Path $temp 'dist/cli.js'
    [System.IO.File]::WriteAllText($cli, '// 本輪固定測試檔，不啟動模型。')
    $package = Join-Path $temp 'package.json'
    & $module {
        $script:adminCalls = 0
        $script:markCalls = 0
        $script:killCalls = 0
        function script:Invoke-DevSpaceAgentAdmin {
            param($NodePath, $DevSpaceCli, $AdminScript, $Action, $AgentId)
            $script:adminCalls++
            if ($Action -eq 'mark-stopped') { $script:markCalls++; throw 'UNEXPECTED_MARK_STOPPED' }
            return [pscustomobject]@{ id=$AgentId; status='running' }
        }
        function script:Get-CimInstance { return @() }
        function script:Stop-Process { $script:killCalls++; throw 'UNEXPECTED_PROCESS_STOP' }
    }
    foreach ($version in @('1.0.8', '9.9.9')) {
        [System.IO.File]::WriteAllText($package, ('{"version":"' + $version + '"}'))
        $message = ''
        try { Stop-DevSpaceAgent -NodePath 'unused' -DevSpaceCli $cli -AdminScript 'unused' -AgentId 'agt_1234abcd' | Out-Null }
        catch { $message = $_.Exception.Message }
        if ($message -notmatch 'NATIVE_STOP_UNSUPPORTED') { throw "錯誤拒絕原因：$message" }
        $counts = & $module { @($script:adminCalls, $script:markCalls, $script:killCalls) }
        if (@($counts | Where-Object { $_ -ne 0 }).Count -ne 0) { throw '不支援的版本仍讀寫狀態或停止程序。' }
        $passed++
    }
    [System.IO.File]::WriteAllText($package, '{"version":"1.0.4"}')
    $message = ''
    try { Stop-DevSpaceAgent -NodePath 'unused' -DevSpaceCli $cli -AdminScript 'unused' -AgentId 'agt_1234abcd' | Out-Null }
    catch { $message = $_.Exception.Message }
    if ($message -notmatch 'STOP_UNCONFIRMED') { throw "沒有觀察到 worker 時回報錯誤：$message" }
    $counts = & $module { @($script:adminCalls, $script:markCalls, $script:killCalls) }
    if ($counts[0] -ne 1 -or $counts[1] -ne 0 -or $counts[2] -ne 0) { throw '沒有停止證據時仍修改紀錄。' }
    $passed++
    Write-Output "PASS: $passed native-stop guard scenarios; fixture-only; no real process stopped."
}
finally {
    Remove-Module $module -Force
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
