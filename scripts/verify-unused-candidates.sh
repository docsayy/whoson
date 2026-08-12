#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

candidates=(
  "src/pages/Dashboard.tsx"
  "src/pages/Login.tsx"
  "src/services/auth.ts"
  "src/types/models.ts"
  "src/services/vacationService.ts"
  "src/types/vacation.ts"
  "src/utils/exportSchedule.ts"
  "src/pages/ServicesPage.tsx"
)

for file in "${candidates[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "MISSING       $file"
    continue
  fi

  stem="$(basename "$file")"
  stem="${stem%.*}"
  references="$(grep -R --line-number --include='*.ts' --include='*.tsx' \
    -E "from ['\"][^'\"]*/${stem}['\"]|import\(['\"][^'\"]*/${stem}['\"]\)" \
    src 2>/dev/null | grep -v "^${file}:" || true)"

  if [[ -z "$references" ]]; then
    echo "UNREFERENCED  $file"
  else
    echo "IN USE        $file"
    echo "$references" | sed 's/^/              /'
  fi
done
