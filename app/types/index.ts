import type { InferSelectModel } from "drizzle-orm";
import type {
  businesses,
  customers,
  ledgerEntries,
  userPermissions,
  users,
} from "~/db/schema";
import type { Permission } from "~/lib/permissions";

// Tipos de dominio derivados del esquema de Drizzle.
// Se centralizan aquí para que las features no importen directamente del esquema.

export type Business = InferSelectModel<typeof businesses>;
export type Customer = InferSelectModel<typeof customers>;
export type LedgerEntry = InferSelectModel<typeof ledgerEntries>;
export type LedgerEntryType = LedgerEntry["type"];
export type User = InferSelectModel<typeof users>;
export type UserPermission = InferSelectModel<typeof userPermissions>;

// Saldo calculado de un cliente (montos en centavos).
// `balanceCents = paymentCents - debtCents` según la regla de negocio.
// `outstandingCents` es la deuda pendiente (positiva cuando el cliente debe).
export type CustomerBalance = {
  customerId: string;
  debtCents: number;
  paymentCents: number;
  balanceCents: number;
  outstandingCents: number;
};

export type CustomerWithBalance = Customer & CustomerBalance;

// Usuario de una tienda con sus permisos granulares resueltos.
export type BusinessUser = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  permissions: Permission[];
};

// Métricas globales de una tienda (montos en centavos).
export type BusinessMetrics = {
  customerCount: number;
  totalDebtCents: number;
  totalPaymentCents: number;
  balanceCents: number;
  outstandingCents: number;
};

// Métricas agregadas de todo el sistema (vista del Superadmin).
export type GlobalMetrics = {
  businessCount: number;
  customerCount: number;
  totalDebtCents: number;
  totalPaymentCents: number;
  balanceCents: number;
  outstandingCents: number;
};

// --- Informes por rango de fechas ---

export type ReportSummary = {
  entryCount: number;
  totalDebtCents: number;
  totalPaymentCents: number;
  balanceCents: number;
  outstandingCents: number;
};

export type ReportMovement = {
  id: string;
  createdAt: Date;
  customerId: string;
  customerName: string;
  type: LedgerEntryType;
  amountCents: number;
  description: string | null;
};

export type CustomerReportRow = {
  customerId: string;
  customerName: string;
  debtCents: number;
  paymentCents: number;
  balanceCents: number;
  outstandingCents: number;
};

export type { Permission };
