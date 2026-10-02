$ErrorActionPreference = "Stop"

# Run from the project repository root.
$tmp = Join-Path $env:TEMP "ai-magic-library"
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }

git clone --quiet https://github.com/erwinmanzano2020/ai-magic.git $tmp

$targets = @{
  "systematic-debugging" = "curated\systematic-debugging"
  "risk-aware-testing" = "curated\risk-aware-testing"
  "adversarial-review" = "curated\adversarial-review"
  "ui-ux-pro-max" = "curated\ui-ux-pro-max\payload"
  "vercel-react-best-practices" = "curated\vercel-react-best-practices\payload"
  "ai-development-system" = "custom\ai-development-system"
}

New-Item -ItemType Directory -Force ".agents\skills" | Out-Null
foreach ($name in $targets.Keys) {
  $src = Join-Path $tmp $targets[$name]
  $dst = Join-Path ".agents\skills" $name
  if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
  Copy-Item -Recurse -Force $src $dst
}

Remove-Item -Recurse -Force $tmp
Write-Host "AI Magic skills synchronized into .agents/skills."
