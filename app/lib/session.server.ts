import { eq } from "drizzle-orm";
import { redirect } from "react-router";
import { db } from "~/db/client.server";
import { userPermissions } from "~/db/schema";
import { auth } from "~/lib/auth.server";
import { isPermission, type Permission } from "~/lib/permissions";

// Contexto de autorización derivado de la sesión.
// `businessId` es null para el Administrador Global (Superadmin).
export type AuthContext = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  businessId: string | null;
  isSuperadmin: boolean;
  permissions: ReadonlySet<Permission>;
};

// Obtiene la sesión y resuelve permisos. Devuelve null si no hay sesión válida.
export async function getAuthContext(
  request: Request,
): Promise<AuthContext | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;

  const user = session.user;
  const businessId = user.businessId ?? null;
  const isSuperadmin = Boolean(user.isSuperadmin);

  const permissions = new Set<Permission>();

  // El Superadmin no requiere permisos explícitos: el bypass ocurre en los guards.
  if (!isSuperadmin) {
    const rows = await db
      .select({ permission: userPermissions.permission })
      .from(userPermissions)
      .where(eq(userPermissions.userId, user.id));

    for (const row of rows) {
      if (isPermission(row.permission)) {
        permissions.add(row.permission);
      }
    }
  }

  return {
    user: { id: user.id, name: user.name, email: user.email },
    businessId,
    isSuperadmin,
    permissions,
  };
}

// Exige sesión activa; redirige a /login en caso contrario.
export function assertAuthenticated(
  context: AuthContext | null,
): asserts context is AuthContext {
  if (!context) {
    throw redirect("/login");
  }
}

// Exige un permiso concreto. El Superadmin siempre pasa.
export function assertPermission(
  context: AuthContext,
  permission: Permission,
): void {
  if (context.isSuperadmin) return;
  if (!context.permissions.has(permission)) {
    throw new Response("No tienes permiso para realizar esta acción.", {
      status: 403,
    });
  }
}

// Exige que el actor sea el Administrador Global.
export function assertSuperadmin(context: AuthContext): void {
  if (!context.isSuperadmin) {
    throw new Response(
      "Solo el Administrador Global puede realizar esta acción.",
      { status: 403 },
    );
  }
}
