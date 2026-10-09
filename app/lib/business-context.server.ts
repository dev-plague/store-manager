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

// Resuelve la tienda activa; si falta, envía al selector de tienda conservando
// el destino original para volver allí tras elegir (evita el rebote confuso al
// dashboard que veía el Administrador Global).
export async function requireBusinessId(
  request: Request,
  auth: AuthContext,
): Promise<string> {
  const businessId = await getActiveBusinessId(request, auth);

  if (!businessId) {
    // El selector de tienda es exclusivo del Administrador Global. Un usuario
    // normal sin tienda asignada es una cuenta mal configurada: se le informa
    // en lugar de redirigir (evita un bucle de redirecciones).
    if (!auth.isSuperadmin) {
      throw new Response(
        "Tu usuario no tiene una tienda asignada. Contacta al administrador.",
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    // En navegaciones de cliente React Router pide los datos a `path.data`;
    // se elimina ese sufijo para conservar la ruta real de destino.
    const pathname = url.pathname.replace(/\.data$/, "");
    const redirectTo = `${pathname}${url.search}`;
    throw redirect(
      `/select-business?redirectTo=${encodeURIComponent(redirectTo)}`,
    );
  }

  return businessId;
}
