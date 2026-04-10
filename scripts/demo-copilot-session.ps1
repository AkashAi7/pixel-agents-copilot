# demo-copilot-session.ps1
# Simulates two concurrent GitHub Copilot Chat sessions writing JSONL tool
# events that the Pixel Agents extension watches and animates as characters.
# Usage: .\scripts\demo-copilot-session.ps1
# Stop with Ctrl+C.

$ErrorActionPreference = "Stop"

$demoDir  = "$env:APPDATA\Code\User\workspaceStorage\pixel-agents-demo\chatSessions"
$session1 = "$demoDir\demo-agent-alpha.jsonl"
$session2 = "$demoDir\demo-agent-beta.jsonl"

New-Item -ItemType Directory -Path $demoDir -Force | Out-Null

function AppendLine([string]$path, [string]$json) {
    [System.IO.File]::AppendAllText($path, $json + "`n", [System.Text.Encoding]::UTF8)
}

function MakeToolStart([int]$req, [string]$callId, [string]$toolId, [string]$msg) {
    $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    return '{"kind":2,"k":["requests",' + $req + ',"response"],"v":[{"kind":"toolInvocationSerialized","toolCallId":"' + $callId + '","toolId":"' + $toolId + '","invocationMessage":{"value":"' + $msg + '","isTrusted":false},"isComplete":false,"isConfirmed":{"type":1},"source":{"type":"internal","label":"Built-In"},"timestamp":' + $ts + '}]}'
}

function MakeToolDone([int]$req, [string]$callId, [string]$toolId, [string]$msg) {
    $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    return '{"kind":2,"k":["requests",' + $req + ',"response"],"v":[{"kind":"toolInvocationSerialized","toolCallId":"' + $callId + '","toolId":"' + $toolId + '","invocationMessage":{"value":"' + $msg + '","isTrusted":false},"isComplete":true,"isConfirmed":{"type":1},"source":{"type":"internal","label":"Built-In"},"timestamp":' + $ts + '}]}'
}

function MakeTurnComplete([int]$req) {
    return '{"kind":1,"k":["requests",' + $req + ',"modelState"],"v":{"value":1}}'
}

function MakeNewRequest([int]$req, [string]$reqId) {
    $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    return '{"kind":2,"k":["requests"],"v":[{"requestId":"' + $reqId + '","timestamp":' + $ts + ',"message":{"text":"demo message ' + $req + '"}}]}'
}

function WriteSnapshot([string]$path, [string]$sessionId, [string]$title) {
    $ts  = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $pad = "x" * 400
    $snap = '{"kind":0,"v":{"version":3,"creationDate":' + $ts + ',"customTitle":"' + $title + '","initialLocation":"panel","responderUsername":"GitHub Copilot","sessionId":"' + $sessionId + '","hasPendingEdits":false,"description":"Pixel Agents demo session padding padding padding padding padding ' + $pad + '","requests":[]}}'
    [System.IO.File]::WriteAllText($path, $snap + "`n", [System.Text.Encoding]::UTF8)
}

$alphaTools = @(
    @("copilot_readFile",       "Reading src/copilotFileWatcher.ts"),
    @("copilot_semanticSearch", "Searching for AgentState usage"),
    @("copilot_grepSearch",     "Searching for PALETTE_COUNT"),
    @("copilot_readFile",       "Reading webview-ui/src/constants.ts"),
    @("copilot_replaceString",  "Editing constants.ts"),
    @("copilot_getErrors",      "Checking TypeScript errors"),
    @("copilot_runInTerminal",  "npm run build"),
    @("copilot_readFile",       "Reading package.json")
)

$betaTools = @(
    @("copilot_fileSearch",     "Searching **/*.test.ts"),
    @("copilot_readFile",       "Reading e2e/tests/agent-spawn.spec.ts"),
    @("copilot_semanticSearch", "Searching for Playwright helpers"),
    @("copilot_createFile",     "Creating e2e/tests/copilot.spec.ts"),
    @("copilot_runTests",       "Running Playwright tests"),
    @("copilot_grepSearch",     "Searching for test helpers"),
    @("copilot_editFile",       "Editing playwright.config.ts"),
    @("copilot_runInTerminal",  "npm run e2e")
)

Write-Host "[demo] Writing initial snapshots:"
Write-Host "  $session1"
Write-Host "  $session2"
Write-Host ""

WriteSnapshot $session1 "demo-agent-alpha-0001" "Pixel Agents Demo - Agent Alpha"
WriteSnapshot $session2 "demo-agent-beta-0001"  "Pixel Agents Demo - Agent Beta"

Write-Host "[demo] Files created. Extension detects them within ~3 seconds."
Write-Host "[demo] Open the Pixel Agents panel in the Extension Dev Host window."
Write-Host "[demo] Press Ctrl+C to stop."
Write-Host ""

Start-Sleep -Milliseconds 4000

$callId = 0
$req    = 0

while ($true) {

    # Agent Alpha turn
    AppendLine $session1 (MakeNewRequest $req "demo-req-alpha-$req")
    Write-Host "[Alpha] Turn $($req+1) started"
    Start-Sleep -Milliseconds 600

    foreach ($tool in $alphaTools) {
        $cid = "call-a-$callId"; $callId++
        AppendLine $session1 (MakeToolStart $req $cid $tool[0] $tool[1])
        Write-Host "  [Alpha]  $($tool[1])..."
        Start-Sleep -Milliseconds (Get-Random -Minimum 800 -Maximum 2200)
        AppendLine $session1 (MakeToolDone  $req $cid $tool[0] $tool[1])
        Start-Sleep -Milliseconds 300
    }

    AppendLine $session1 (MakeTurnComplete $req)
    Write-Host "  [Alpha]  Turn complete, waiting..."
    Start-Sleep -Milliseconds (Get-Random -Minimum 3000 -Maximum 6000)

    # Agent Beta turn
    AppendLine $session2 (MakeNewRequest $req "demo-req-beta-$req")
    Write-Host "[Beta]  Turn $($req+1) started"
    Start-Sleep -Milliseconds 400

    foreach ($tool in $betaTools) {
        $cid = "call-b-$callId"; $callId++
        AppendLine $session2 (MakeToolStart $req $cid $tool[0] $tool[1])
        Write-Host "  [Beta]   $($tool[1])..."
        Start-Sleep -Milliseconds (Get-Random -Minimum 600 -Maximum 1800)
        AppendLine $session2 (MakeToolDone  $req $cid $tool[0] $tool[1])
        Start-Sleep -Milliseconds 200
    }

    AppendLine $session2 (MakeTurnComplete $req)
    Write-Host "  [Beta]   Turn complete, waiting..."
    Start-Sleep -Milliseconds (Get-Random -Minimum 2000 -Maximum 5000)

    $req++

    if ($req -ge 5) {
        Write-Host ""
        Write-Host "[demo] Resetting session files (starting round 2)..."
        Write-Host ""
        $ts = Get-Date -Format "HHmmss"
        WriteSnapshot $session1 "demo-agent-alpha-$ts" "Pixel Agents Demo - Agent Alpha"
        WriteSnapshot $session2 "demo-agent-beta-$ts"  "Pixel Agents Demo - Agent Beta"
        $req = 0
        Start-Sleep -Milliseconds 4000
    }
}
