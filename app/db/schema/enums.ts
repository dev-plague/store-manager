import { pgEnum } from "drizzle-orm/pg-core";

// Tipo de movimiento contable dentro del libro mayor (ledger).
// DEBT  -> el cliente adquiere una deuda (compra fiada).
// PAYMENT -> el cliente realiza un abono (pago total o parcial).
export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "DEBT",
  "PAYMENT",
]);

export type LedgerEntryType = (typeof ledgerEntryTypeEnum.enumValues)[number];
