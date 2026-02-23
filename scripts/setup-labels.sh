#!/usr/bin/env bash
# Setup GitHub labels for the Tino project
# Usage: ./scripts/setup-labels.sh [--delete-defaults]
#
# Requires: gh CLI authenticated with repo access

set -euo pipefail

REPO="ChoKhoOu/tino"

# Delete default GitHub labels that we're replacing with prefixed versions
if [[ "${1:-}" == "--delete-defaults" ]]; then
  echo "Removing default labels..."
  for label in "bug" "documentation" "duplicate" "enhancement" "invalid" "question" "wontfix"; do
    gh label delete "$label" --repo "$REPO" --yes 2>/dev/null || true
  done
  echo "Default labels removed."
fi

echo "Creating labels..."

# Type labels (blue family)
gh label create "type/bug"         --description "Bug report"                    --color "d73a4a" --repo "$REPO" --force
gh label create "type/feature"     --description "New feature request"           --color "0075ca" --repo "$REPO" --force
gh label create "type/enhancement" --description "Enhancement to existing feature" --color "a2eeef" --repo "$REPO" --force
gh label create "type/prd"         --description "Product Requirements Document" --color "1d76db" --repo "$REPO" --force
gh label create "type/chore"       --description "Maintenance / housekeeping"    --color "e4e669" --repo "$REPO" --force
gh label create "type/docs"        --description "Documentation"                 --color "0075ca" --repo "$REPO" --force
gh label create "type/refactor"    --description "Code refactoring"              --color "d4c5f9" --repo "$REPO" --force
gh label create "type/tests"       --description "Test-related changes"          --color "bfd4f2" --repo "$REPO" --force
gh label create "type/ci"          --description "CI/CD changes"                 --color "e4e669" --repo "$REPO" --force
gh label create "type/deps"        --description "Dependency updates"            --color "ededed" --repo "$REPO" --force

# Priority labels (red-to-green gradient)
gh label create "priority/critical" --description "Critical: must fix immediately" --color "b60205" --repo "$REPO" --force
gh label create "priority/high"     --description "High priority"                  --color "d93f0b" --repo "$REPO" --force
gh label create "priority/medium"   --description "Medium priority"                --color "fbca04" --repo "$REPO" --force
gh label create "priority/low"      --description "Low priority"                   --color "0e8a16" --repo "$REPO" --force

# Area labels (purple family)
gh label create "area/cli"      --description "CLI and TUI (Ink)"          --color "7057ff" --repo "$REPO" --force
gh label create "area/daemon"   --description "Python NautilusTrader daemon" --color "8b5cf6" --repo "$REPO" --force
gh label create "area/grpc"     --description "gRPC / ConnectRPC layer"    --color "6f42c1" --repo "$REPO" --force
gh label create "area/tools"    --description "Agent tools"                --color "9333ea" --repo "$REPO" --force
gh label create "area/trading"  --description "Trading (live/paper)"       --color "a855f7" --repo "$REPO" --force
gh label create "area/data"     --description "Data providers"             --color "c084fc" --repo "$REPO" --force
gh label create "area/config"   --description "Configuration and settings" --color "7c3aed" --repo "$REPO" --force
gh label create "area/agents"   --description "Agent system"               --color "6d28d9" --repo "$REPO" --force
gh label create "area/runtime"  --description "Runtime and session"        --color "5b21b6" --repo "$REPO" --force

# Status labels (gray/neutral)
gh label create "status/triage"     --description "Needs triage"                   --color "ededed" --repo "$REPO" --force
gh label create "status/needs-info" --description "Waiting for more information"   --color "f9d0c4" --repo "$REPO" --force
gh label create "status/blocked"    --description "Blocked by another issue"       --color "b60205" --repo "$REPO" --force
gh label create "status/wontfix"    --description "Will not be fixed"              --color "ffffff" --repo "$REPO" --force
gh label create "status/duplicate"  --description "Duplicate of another issue"     --color "cfd3d7" --repo "$REPO" --force
gh label create "status/stale"      --description "No recent activity"             --color "ededed" --repo "$REPO" --force

# Effort labels (size)
gh label create "effort/small"  --description "Small: a few hours"  --color "0e8a16" --repo "$REPO" --force
gh label create "effort/medium" --description "Medium: a few days"  --color "fbca04" --repo "$REPO" --force
gh label create "effort/large"  --description "Large: a week+"      --color "d93f0b" --repo "$REPO" --force

# Keep these standard labels (GitHub surfaces them in search)
gh label create "good first issue" --description "Good for newcomers" --color "7057ff" --repo "$REPO" --force
gh label create "help wanted"      --description "Extra attention is needed" --color "008672" --repo "$REPO" --force

echo ""
echo "Done! All labels created for $REPO"
echo "Run with --delete-defaults to also remove GitHub's default labels."
