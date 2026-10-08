import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "~/db/client.server";
import { sessions, userPermissions, users } from "~/db/schema";
import { auth } from "~/lib/auth.server";
import { isPermission, type Permission } from "~/lib/permissions";
import type { BusinessUser } from "~/types";

// Contrato interno de Better Auth que usamos para restablecer contraseñas.
// Es el mismo mecanismo que emplea el plugin `admin` (setUserPassword), pero
// aquí lo exponemos detrás de nuestro permiso granular `users:manage` para no
// introducir roles rígidos.
type InternalAuthContext = {
  password: {
    hash: (password: string) => Promise<string>;
  };
  internalAdapter: {
    findCredentialAccount: (userId: string) => Promise<unknown>;
    updatePassword: (userId: string, password: string) => Promise<unknown>;
    createAccount: (account: {
      userId: string;
      providerId: string;
      accountId: string;
      password: string;
    }) => Promise<unknown>;
  };
};

// Gestión de usuarios y permisos por tienda.
// TODAS las operaciones validan el `business_id` para respetar el aislamiento.

export type CreateBusinessUserInput = {
  businessId: string;
  name: string;
  email: string;
  password: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Lista los usuarios de una tienda con sus permisos resueltos.
export async function listBusinessUsers(
  businessId: string,
): Promise<BusinessUser[]> {
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.businessId, businessId))
    .orderBy(asc(users.name));

  if (members.length === 0) return [];

  const permissionRows = await db
    .select({
      userId: userPermissions.userId,
      permission: userPermissions.permission,
    })
    .from(userPermissions)
    .where(
      and(
        eq(userPermissions.businessId, businessId),
        inArray(
          userPermissions.userId,
          members.map((member) => member.id),
        ),
      ),
    );

  const byUser = new Map<string, Permission[]>();
  for (const row of permissionRows) {
    if (!isPermission(row.permission)) continue;
    const granted = byUser.get(row.userId) ?? [];
    granted.push(row.permission);
    byUser.set(row.userId, granted);
  }

  return members.map((member) => ({
    ...member,
    permissions: byUser.get(member.id) ?? [],
  }));
}

// Recupera un usuario validando que pertenezca a la tienda.
export async function getBusinessUser(
  businessId: string,
  userId: string,
): Promise<BusinessUser | null> {
  const [member] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.businessId, businessId)))
    .limit(1);

  if (!member) return null;

  const permissionRows = await db
    .select({ permission: userPermissions.permission })
    .from(userPermissions)
    .where(
      and(
        eq(userPermissions.businessId, businessId),
        eq(userPermissions.userId, userId),
      ),
    );

  return {
    ...member,
    permissions: permissionRows
      .map((row) => row.permission)
      .filter(isPermission),
  };
}

// Crea un usuario en la tienda. Better Auth se encarga del hash de la contraseña.
export async function createBusinessUser(
  input: CreateBusinessUserInput,
): Promise<string> {
  const email = normalizeEmail(input.email);

  if (input.name.trim().length === 0) {
    throw new Response("El nombre es obligatorio.", { status: 400 });
  }
  if (input.password.length < 8) {
    throw new Response("La contraseña debe tener al menos 8 caracteres.", {
      status: 400,
    });
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    throw new Response("Ya existe un usuario con ese correo.", { status: 400 });
  }

  await auth.api.signUpEmail({
    body: { name: input.name.trim(), email, password: input.password },
  });

  const [created] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!created) {
    throw new Response("No se pudo crear el usuario.", { status: 500 });
  }

  // Se asigna la tienda después de crearlo (Better Auth no lo permite en el alta).
  await db
    .update(users)
    .set({ businessId: input.businessId })
    .where(eq(users.id, created.id));

  return created.id;
}

export async function updateBusinessUserName(
  businessId: string,
  userId: string,
  name: string,
): Promise<void> {
  if (name.trim().length === 0) {
    throw new Response("El nombre es obligatorio.", { status: 400 });
  }

  const [member] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.businessId, businessId)))
    .limit(1);

  if (!member) {
    throw new Response("Usuario no encontrado.", { status: 404 });
  }

  await db
    .update(users)
    .set({ name: name.trim() })
    .where(eq(users.id, userId));
}

// Reemplaza por completo el conjunto de permisos de un usuario de la tienda.
export async function setUserPermissions(input: {
  businessId: string;
  userId: string;
  permissions: Permission[];
  grantedBy: string;
}): Promise<void> {
  const [member] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.id, input.userId), eq(users.businessId, input.businessId)),
    )
    .limit(1);

  if (!member) {
    throw new Response("Usuario no encontrado.", { status: 404 });
  }

  const unique = [...new Set(input.permissions)].filter(isPermission);

  await db.transaction(async (tx) => {
    await tx
      .delete(userPermissions)
      .where(
        and(
          eq(userPermissions.businessId, input.businessId),
          eq(userPermissions.userId, input.userId),
        ),
      );

    if (unique.length > 0) {
      await tx.insert(userPermissions).values(
        unique.map((permission) => ({
          businessId: input.businessId,
          userId: input.userId,
          permission,
          grantedBy: input.grantedBy,
        })),
      );
    }
  });
}

// Restablece la contraseña de un usuario de la tienda (lo hace un administrador
// con `users:manage`, sin conocer la contraseña actual).
// Opcionalmente revoca las sesiones activas para forzar el reingreso.
export async function setBusinessUserPassword(input: {
  businessId: string;
  userId: string;
  newPassword: string;
  revokeSessions?: boolean;
}): Promise<void> {
  if (input.newPassword.length < 8 || input.newPassword.length > 128) {
    throw new Response("La contraseña debe tener entre 8 y 128 caracteres.", {
      status: 400,
    });
  }

  const [member] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.id, input.userId), eq(users.businessId, input.businessId)),
    )
    .limit(1);

  if (!member) {
    throw new Response("Usuario no encontrado.", { status: 404 });
  }

  const ctx = (await auth.$context) as unknown as InternalAuthContext;
  const hashedPassword = await ctx.password.hash(input.newPassword);

  // Si ya tiene cuenta de credenciales se actualiza; si no (p. ej. OAuth), se crea.
  if (await ctx.internalAdapter.findCredentialAccount(input.userId)) {
    await ctx.internalAdapter.updatePassword(input.userId, hashedPassword);
  } else {
    await ctx.internalAdapter.createAccount({
      userId: input.userId,
      providerId: "credential",
      accountId: input.userId,
      password: hashedPassword,
    });
  }

  if (input.revokeSessions ?? true) {
    await db.delete(sessions).where(eq(sessions.userId, input.userId));
  }
}
