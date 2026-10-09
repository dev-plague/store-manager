import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Tienda / negocio. Es la raíz del aislamiento multi-tenant:
// cada tabla de negocio referencia a `businesses.id` mediante `business_id`.
export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  // Código ISO 4217 de la moneda (ej: "COP", "USD", "MXN").
  currency: text("currency").notNull().default("COP"),
  // Zona horaria IANA para reportes (por defecto Colombia, UTC-5).
  timezone: text("timezone").notNull().default("America/Bogota"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
