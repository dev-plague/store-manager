import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { businesses } from "./businesses";

// Permisos granulares asignados a un usuario dentro de una tienda.
// No hay roles rígidos: cada fila concede un permiso concreto del catálogo
// definido en `app/lib/permissions.ts` (ej: "customers:create").
// El Administrador Global (Superadmin) no necesita filas aquí.
export const userPermissions = pgTable(
  "user_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Clave del permiso, validada en la capa de aplicación con Zod.
    permission: text("permission").notNull(),
    grantedBy: text("granted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_permissions_user_permission_uq").on(
      table.userId,
      table.permission,
    ),
    index("user_permissions_business_id_idx").on(table.businessId),
    index("user_permissions_user_id_idx").on(table.userId),
  ],
);

export type UserPermission = typeof userPermissions.$inferSelect;
export type NewUserPermission = typeof userPermissions.$inferInsert;
