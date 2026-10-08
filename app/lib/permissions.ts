import { z } from "zod";

// Catálogo central de permisos granulares (RBAC).
// Es la única fuente de verdad: la base de datos guarda estas claves como texto
// y la capa de aplicación las valida con `permissionSchema`.
export const PERMISSION_LIST = [
  "businesses:manage",
  "customers:create",
  "customers:read",
  "customers:update",
  "customers:delete",
  "debts:create",
  "debts:read",
  "payments:create",
  "payments:read",
  "ledger:adjust",
  "metrics:read",
  "users:manage",
] as const;

export type Permission = (typeof PERMISSION_LIST)[number];

// Esquema Zod para validar entradas (formularios, API, seed).
export const permissionSchema = z.enum(PERMISSION_LIST);

// Agrupación de permisos por recurso, útil para construir la UI de administración.
export const PERMISSIONS = {
  businesses: ["businesses:manage"],
  customers: [
    "customers:create",
    "customers:read",
    "customers:update",
    "customers:delete",
  ],
  debts: ["debts:create", "debts:read"],
  payments: ["payments:create", "payments:read"],
  ledger: ["ledger:adjust"],
  metrics: ["metrics:read"],
  users: ["users:manage"],
} as const satisfies Record<string, readonly Permission[]>;

// Etiquetas en español para mostrar en la interfaz.
export const PERMISSION_LABELS: Record<Permission, string> = {
  "businesses:manage": "Gestionar tiendas",
  "customers:create": "Crear clientes",
  "customers:read": "Ver clientes",
  "customers:update": "Editar clientes",
  "customers:delete": "Eliminar clientes",
  "debts:create": "Registrar deudas",
  "debts:read": "Ver deudas",
  "payments:create": "Registrar abonos",
  "payments:read": "Ver abonos",
  "ledger:adjust": "Anular y corregir movimientos",
  "metrics:read": "Ver métricas",
  "users:manage": "Gestionar usuarios y permisos",
};

// Etiquetas por recurso (agrupación del catálogo).
export const RESOURCE_LABELS: Record<keyof typeof PERMISSIONS, string> = {
  businesses: "Tiendas",
  customers: "Clientes",
  debts: "Deudas",
  payments: "Abonos",
  ledger: "Correcciones del ledger",
  metrics: "Métricas",
  users: "Usuarios y permisos",
};

// Guard de tipo: valida que un string arbitrario sea un permiso del catálogo.
export function isPermission(value: string): value is Permission {
  return (PERMISSION_LIST as readonly string[]).includes(value);
}

// Permisos de alcance global (solo el Administrador Global puede otorgarlos).
export const GLOBAL_PERMISSIONS: readonly Permission[] = ["businesses:manage"];

// Permisos que un actor puede otorgar según su alcance.
// Un usuario de tienda no puede conceder permisos globales.
export function grantablePermissions(isSuperadmin: boolean): Permission[] {
  return isSuperadmin
    ? [...PERMISSION_LIST]
    : PERMISSION_LIST.filter(
        (permission) => !GLOBAL_PERMISSIONS.includes(permission),
      );
}

// Verifica si un conjunto de permisos concedidos incluye el permiso requerido.
export function hasPermission(
  granted: ReadonlySet<Permission>,
  required: Permission,
): boolean {
  return granted.has(required);
}
