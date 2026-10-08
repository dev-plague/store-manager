import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { db } from "~/db/client.server";
import * as schema from "~/db/schema";
import { env } from "~/lib/env.server";

// Instancia de Better Auth.
// - Las tablas del núcleo viven en `app/db/schema/auth.ts` (en plural).
// - `businessId` e `isSuperadmin` son campos adicionales gestionados solo en
//   el servidor (`input: false`) para impedir escaladas de privilegios.
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      businessId: {
        type: "string",
        required: false,
        input: false,
      },
      isSuperadmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  advanced: {
    database: {
      // Habilita joins en endpoints como /get-session.
      joins: true,
    },
  },
});

export type Auth = typeof auth;
