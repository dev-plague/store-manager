import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { businesses } from "./businesses";
import { customers } from "./customers";
import { ledgerEntryTypeEnum } from "./enums";

// Libro mayor (ledger) con transacciones inmutables.
// El saldo del cliente NO se guarda: se calcula como
//   SUM(PAYMENT) - SUM(DEBT)
// Los montos se almacenan como enteros en la unidad mínima de la moneda
// (centavos) para evitar errores de punto flotante. Siempre positivos.
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    type: ledgerEntryTypeEnum("type").notNull(),
    description: text("description"),
    // Anulación / corrección con contra-asientos (el ledger no se edita):
    // - `voided_at` / `voided_by` marcan la entrada original como anulada.
    // - `reversal_of_id` apunta a la entrada original desde el contra-asiento.
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: text("voided_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reversalOfId: uuid("reversal_of_id").references(
      (): AnyPgColumn => ledgerEntries.id,
      { onDelete: "set null" },
    ),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ledger_entries_business_id_idx").on(table.businessId),
    index("ledger_entries_customer_id_idx").on(table.customerId),
    index("ledger_entries_business_customer_idx").on(
      table.businessId,
      table.customerId,
    ),
    index("ledger_entries_created_at_idx").on(table.createdAt),
    index("ledger_entries_reversal_of_idx").on(table.reversalOfId),
    check("ledger_entries_amount_positive", sql`${table.amount} > 0`),
  ],
);

export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type NewLedgerEntry = typeof ledgerEntries.$inferInsert;
