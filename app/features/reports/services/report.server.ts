import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { customers, ledgerEntries } from "~/db/schema";
import type {
  CustomerReportRow,
  ReportMovement,
  ReportSummary,
} from "~/types";

// Informes contables por rango de fechas (scoped por `business_id`).
// Solo se consideran entradas vigentes (ni anuladas ni reversos).

const activeEntry = () =>
  and(isNull(ledgerEntries.voidedAt), isNull(ledgerEntries.reversalOfId));

export type ReportRangeFilter = {
  from: Date;
  to: Date; // exclusivo
};

// Totales del periodo.
export async function getReportSummary(
  businessId: string,
  range: ReportRangeFilter,
  customerId?: string | null,
): Promise<ReportSummary> {
  const [row] = await db
    .select({
      debt: sql<string>`coalesce(sum(case when ${ledgerEntries.type} = 'DEBT' then ${ledgerEntries.amount} else 0 end), 0)::bigint`,
      payment: sql<string>`coalesce(sum(case when ${ledgerEntries.type} = 'PAYMENT' then ${ledgerEntries.amount} else 0 end), 0)::bigint`,
      entryCount: sql<string>`count(*)`,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.businessId, businessId),
        gte(ledgerEntries.createdAt, range.from),
        lt(ledgerEntries.createdAt, range.to),
        customerId ? eq(ledgerEntries.customerId, customerId) : undefined,
        activeEntry(),
      ),
    );

  const totalDebtCents = Number(row?.debt ?? 0);
  const totalPaymentCents = Number(row?.payment ?? 0);

  return {
    entryCount: Number(row?.entryCount ?? 0),
    totalDebtCents,
    totalPaymentCents,
    balanceCents: totalPaymentCents - totalDebtCents,
    outstandingCents: totalDebtCents - totalPaymentCents,
  };
}

// Movimientos del periodo (con el nombre del cliente).
export async function listReportMovements(
  businessId: string,
  range: ReportRangeFilter,
  customerId?: string | null,
): Promise<ReportMovement[]> {
  const rows = await db
    .select({
      id: ledgerEntries.id,
      createdAt: ledgerEntries.createdAt,
      customerId: ledgerEntries.customerId,
      type: ledgerEntries.type,
      amount: ledgerEntries.amount,
      description: ledgerEntries.description,
      firstName: customers.firstName,
      lastName: customers.lastName,
    })
    .from(ledgerEntries)
    .innerJoin(customers, eq(customers.id, ledgerEntries.customerId))
    .where(
      and(
        eq(ledgerEntries.businessId, businessId),
        gte(ledgerEntries.createdAt, range.from),
        lt(ledgerEntries.createdAt, range.to),
        customerId ? eq(ledgerEntries.customerId, customerId) : undefined,
        activeEntry(),
      ),
    )
    .orderBy(desc(ledgerEntries.createdAt));

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    customerId: row.customerId,
    customerName: `${row.firstName} ${row.lastName}`,
    type: row.type,
    amountCents: row.amount,
    description: row.description,
  }));
}

// Desglose por cliente con actividad en el periodo.
export async function getCustomerReport(
  businessId: string,
  range: ReportRangeFilter,
  customerId?: string | null,
): Promise<CustomerReportRow[]> {
  const rows = await db
    .select({
      customerId: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      debt: sql<string>`coalesce(sum(case when ${ledgerEntries.type} = 'DEBT' then ${ledgerEntries.amount} else 0 end), 0)::bigint`,
      payment: sql<string>`coalesce(sum(case when ${ledgerEntries.type} = 'PAYMENT' then ${ledgerEntries.amount} else 0 end), 0)::bigint`,
    })
    .from(customers)
    .leftJoin(
      ledgerEntries,
      and(
        eq(ledgerEntries.customerId, customers.id),
        eq(ledgerEntries.businessId, businessId),
        gte(ledgerEntries.createdAt, range.from),
        lt(ledgerEntries.createdAt, range.to),
        activeEntry(),
      ),
    )
    .where(
      and(
        eq(customers.businessId, businessId),
        customerId ? eq(customers.id, customerId) : undefined,
      ),
    )
    .groupBy(customers.id)
    .having(sql`count(${ledgerEntries.id}) > 0`)
    .orderBy(asc(customers.firstName), asc(customers.lastName));

  return rows.map((row) => {
    const debtCents = Number(row.debt);
    const paymentCents = Number(row.payment);

    return {
      customerId: row.customerId,
      customerName: `${row.firstName} ${row.lastName}`,
      debtCents,
      paymentCents,
      balanceCents: paymentCents - debtCents,
      outstandingCents: debtCents - paymentCents,
    };
  });
}
