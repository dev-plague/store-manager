import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Configuración del CLI de Drizzle Kit para PostgreSQL.
export default defineConfig({
  schema: "./app/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
