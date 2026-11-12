param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Command,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
)
# Surface failure details as GitHub check annotations as well as ordinary logs.
# No credentials are printed by this helper; callers must not pass secrets as arguments.
$ErrorActionPreference = 'Continue'
$tail = [System.Collections.Generic.List[string]]::new()
$global:LASTEXITCODE = 0
& $Command @Arguments 2>&1 | ForEach-Object {
  $line = [string]$_
  Write-Host $line
  $tail.Add($line)
  if ($tail.Count -gt 40) { $tail.RemoveAt(0) }
}
$code = $LASTEXITCODE
if ($code -ne 0) {
  $detail = ($tail -join "`n").Replace('%','%25').Replace("`r",'%0D').Replace("`n",'%0A')
  Write-Host "::error title=Command failed ($Command)::$detail"
  exit $code
}
