#!/usr/bin/env bash
# Runs migrations + tests on a throwaway LOCAL Postgres (never a real Supabase project).
# Usage: PGHOST=/tmp PGPORT=5433 PGUSER=postgres ./run_local_tests.sh
set -euo pipefail
cd "$(dirname "$0")"

psql -q -c "drop database if exists findit_test" -c "create database findit_test" >/dev/null 2>&1

for f in \
  tests/00_mock_supabase.sql \
  migrations/001_schema.sql \
  migrations/002_security.sql \
  migrations/003_functions.sql \
  migrations/004_matching.sql \
  migrations/005_harden_admin_suspension.sql \
  migrations/006_retention_audit_abuse_guards.sql \
  migrations/007_image_ai_arabic_maps_realtime.sql \
  migrations/008_private_images_signed_urls.sql \
  migrations/009_scale_privacy_hardening.sql \
  migrations/010_restore_items_insert_privilege.sql \
  migrations/011_nemotron_item_embeddings.sql \
  migrations/012_nemotron_allowed_origin.sql; do
  psql -q -d findit_test -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done

log_file="$(mktemp)"
trap 'rm -f "$log_file"' EXIT
psql -d findit_test -v ON_ERROR_STOP=1 -f tests/01_security_and_matching_tests.sql 2>&1 | tee "$log_file" | sed -n '/ERROR/p;/===== RESULTS/,$p'
psql -d findit_test -v ON_ERROR_STOP=1 -f tests/02_hardening_tests.sql 2>&1 | tee -a "$log_file" | sed -n '/ERROR/p'
psql -d findit_test -v ON_ERROR_STOP=1 -f tests/03_items_insert_grants.sql 2>&1 | tee -a "$log_file" | sed -n '/ERROR/p;/===== 010 TESTS DONE/,$p'
psql -d findit_test -v ON_ERROR_STOP=1 -f tests/04_nemotron_embeddings.sql 2>&1 | tee -a "$log_file" | sed -n '/ERROR/p;/===== 011 TESTS DONE/,$p'
failed="$(psql -d findit_test -Atc 'select count(*) from test.results where not ok')"
total="$(psql -d findit_test -Atc 'select count(*) from test.results')"
if grep -q 'ERROR\|error:' "$log_file" || [ "$failed" != "0" ] || [ "$total" -eq 0 ]; then
  echo "Database test suite reported failures ($failed failed of $total)." >&2
  exit 1
fi
echo "Database test suite passed ($total tests)."
