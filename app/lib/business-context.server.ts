import { createCookie, redirect } from "react-router";
import { z } from "zod";
import type { AuthContext } from "~/lib/session.server";

// Contexto de tienda activa.
//
// - Los usuarios de tienda están atados a su propio `business_id`.
// - El Administrador Global (Superadmin) no tiene tienda asignada, así que
//   elige una "tienda activa" que se guarda en esta cookie. De ese modo puede
//   gestionar cualquier tienda sin duplicar rutas.
export const activeBusinessCookie = createCookie("sm_active_business", {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 días
});

const uuidSchema = z.uuid();

// Devuelve el `business_id` activo o null si no hay ninguno seleccionado.
export async function getActiveBusinessId(
  request: Request,
  auth: AuthContext,
): Promise<string | null> {
  if (!auth.isSuperadmin) {
    return auth.businessId ?? null;
  }

  const value = await activeBusinessCookie.parse(
    request.headers.get("Cookie"),
  );

  // Se valida el formato para evitar consultas con UUIDs inválidos.
  return typeof value === "string" && uuidSchema.safeParse(value).success
    ? value
    : null;
}

// Serializa la cookie con la tienda elegida.
export function setActiveBusinessCookie(businessId: string): Promise<string> {
  return activeBusinessCookie.serialize(businessId);
}

// Invalida la cookie (el Superadmin vuelve a la vista global).
export function clearActiveBusinessCookie(): Promise<string> {
  return activeBusinessCookie.serialize("", { maxAge: 0 });
}

// Resuelve la tienda activa; si falta, redirige al panel global para elegirla.
export async function requireBusinessId(
  request: Request,
  auth: AuthContext,
): Promise<string> {
  const businessId = await getActiveBusinessId(request, auth);

  if (!businessId) {
    throw redirect("/dashboard");
  }

  return businessId;
}
