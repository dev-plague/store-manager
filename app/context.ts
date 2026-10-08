import { createContext } from "react-router";
import type { AuthContext } from "~/lib/session.server";

// Contexto de React Router que transporta la autorización desde el middleware
// hacia los loaders/actions. Es null cuando no hay sesión.
export const authContext = createContext<AuthContext | null>(null);
