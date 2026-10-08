import "dotenv/config";
import { z } from "zod";

// Validación de variables de entorno al arrancar. Falla rápido y con mensajes claros.
const envSchema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32, {
    message: "BETTER_AUTH_SECRET debe tener al menos 32 caracteres",
  }),
  BETTER_AUTH_URL: z.url(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Variables de entorno inválidas:",
    z.treeifyError(parsed.error),
  );
  throw new Error("Configuración de entorno inválida");
}

export const env = parsed.data;
export type Env = typeof env;
