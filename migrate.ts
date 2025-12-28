#!/usr/bin/env bun

import { Migration } from "./src/models";

const command = process.argv[2];

async function main() {
  switch (command) {
    case "migrate":
      console.log("🚀 Running database migrations...");
      await Migration.runMigrations();
      console.log("✅ Migration completed successfully!");
      process.exit(0);

    case "reset":
      console.log("⚠️  Resetting database (this will delete all data)...");
      await Migration.resetDatabase();
      console.log("✅ Database reset completed!");
      process.exit(0);

    case "drop":
      console.log("🗑️  Dropping all tables...");
      await Migration.dropAllTables();
      console.log("✅ All tables dropped!");
      process.exit(0);

    case "help":
    default:
      console.log(`
📦 Billiard Management Database CLI

Usage:
  bun run migrate.ts <command>

Commands:
  migrate    Run database migrations (create tables)
  reset      Drop all tables and recreate them (⚠️  deletes all data)
  drop       Drop all tables (⚠️  deletes all data)
  help       Show this help message

Examples:
  bun run migrate.ts migrate    # Create all tables
  bun run migrate.ts reset      # Reset database
  bun run migrate.ts drop       # Drop all tables
            `);
      process.exit(0);
  }
}

main().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
