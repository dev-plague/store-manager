import { createAuthClient } from "better-auth/react";

// Cliente de Better Auth para el navegador.
// Por defecto usa el origen actual de la página.
export const authClient = createAuthClient();

export const { signIn, signOut, signUp, useSession } = authClient;
