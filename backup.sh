#!/bin/bash
# ============================================
# Project Backup Script
# Generates a timestamped ZIP of the full codebase
# ============================================

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PROJECT_NAME="race-team-app"
BACKUP_NAME="${PROJECT_NAME}_backup_${TIMESTAMP}.zip"

echo "Creating backup: ${BACKUP_NAME}"

zip -r "${BACKUP_NAME}" \
  src/ \
  public/ \
  sql_master_create_all_tables.sql \
  sql_migration_incremental.sql \
  sql_diagnostic_check.sql \
  sql_add_component_parts_columns.sql \
  supabase_schema.sql \
  index.html \
  package.json \
  tsconfig.json \
  tsconfig.app.json \
  tsconfig.node.json \
  vite.config.ts \
  tailwind.config.ts \
  postcss.config.js \
  eslint.config.js \
  components.json \
  README.md \
  .gitignore \
  -x "node_modules/*" "dist/*" ".git/*" "*.log"


echo ""
echo "Backup complete: ${BACKUP_NAME}"
echo "Size: $(du -h "${BACKUP_NAME}" | cut -f1)"
echo ""
echo "Contents:"
unzip -l "${BACKUP_NAME}" | tail -1
