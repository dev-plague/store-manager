import { and, asc, count, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { businesses, customers, ledgerEntries } from "~/db/schema";
import { DEFAULT_TIMEZONE, getTimeZoneOffsetMs } from "~/lib/time";
import type {
  BusinessMetrics,
  CustomerWithBalance,
  GlobalMetrics,
} from "~/types";

// Métricas contables por tienda. Todas las consultas filtran por `businessId`.

// Totales globales de la tienda.
export async function getBusinessMetrics(
  businessId: string,
): Promise<BusinessMetrics> {
  const [row] = await db
    .select({
      customerCount: sql<string>`count(distinct ${ledgerEntries.customerId})`,
      debt: sql<string>`coalesce(sum(case when ${ledgerEntries.type} = 'DEBT' then ${ledgerEntries.amount} else 0 end), 0)::bigint`,
      payment: sql<string>`coalesce(sum(case when ${ledgerEntries.type} = 'PAYMENT' then ${ledgerEntries.amount} else 0 end), 0)::bigint`,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.businessId, businessId),
        isNull(ledgerEntries.voidedAt),
        isNull(ledgerEntries.reversalOfId),
      ),
    );

  const totalDebtCents = Number(row?.debt ?? 0);
  const totalPaymentCents = Number(row?.payment ?? 0);

  return {
    customerCount: Number(row?.customerCount ?? 0),
    totalDebtCents,
    totalPaymentCents,
    balanceCents: totalPaymentCents - totalDebtCents,
    outstandingCents: totalDebtCents - totalPaymentCents,
  };
}

// Totales agregados de todo el sistema (vista del Administrador Global).
export async function getGlobalMetrics(): Promise<GlobalMetrics> {
  const [ledgerRows, businessRows, customerRows] = await Promise.all([
    db
      .select({
        debt: sql<string>`coalesce(sum(case when ${ledgerEntries.type} = 'DEBT' then ${ledgerEntries.amount} else 0 end), 0)::bigint`,
        payment: sql<string>`coalesce(sum(case when ${ledgerEntries.type} = 'PAYMENT' then ${ledgerEntries.amount} else 0 end), 0)::bigint`,
      })
      .from(ledgerEntries)
      .where(
        and(
          isNull(ledgerEntries.voidedAt),
          isNull(ledgerEntries.reversalOfId),
        ),
      ),
    db.select({ value: count() }).from(businesses),
    db.select({ value: count() }).from(customers),
  ]);

  const totalDebtCents = Number(ledgerRows[0]?.debt ?? 0);
  const totalPaymentCents = Number(ledgerRows[0]?.payment ?? 0);

  return {
    businessCount: businessRows[0]?.value ?? 0,
    customerCount: customerRows[0]?.value ?? 0,
    totalDebtCents,
    totalPaymentCents,
    balanceCents: totalPaymentCents - totalDebtCents,
    outstandingCents: totalDebtCents - totalPaymentCents,
  };
}

// Punto de la serie mensual de flujo (deudas vs abonos).
export type MonthlyFlowPoint = {
  month: string;
  label: string;
  debtCents: number;
  paymentCents: number;
};

const MONTH_LABELS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

// Flujo mensual de los últimos `months` meses, agrupado por mes LOCAL de la
// tienda (`timeZone`). Si `businessId` es null, agrega todas las tiendas.
export async function getMonthlyFlow(
  businessId: string | null,
  months = 6,
  timeZone = DEFAULT_TIMEZONE,
): Promise<MonthlyFlowPoint[]> {
  const now = new Date();
  const offset = getTimeZoneOffsetMs(timeZone, now);

  // "Ahora" en el reloj local, representado con métodos UTC para hacer
  // aritmética de calendario independiente de la zona del servidor.
  const localNow = new Date(now.getTime() + offset);
  const startLocal = new Date(
    Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth() - (months - 1), 1),
  );
  const start = new Date(startLocal.getTime() - offset);

  // Se calcula el mes local en una subconsulta (el parámetro de zona aparece una
  // sola vez) y se agrupa por esa columna en la consulta externa.
  const localMonth = sql`date_trunc('month', ${ledgerEntries.createdAt} AT TIME ZONE ${timeZone})`;

  const entriesWithMonth = db
    .select({
      month: localMonth.as("month"),
      type: ledgerEntries.type,
      amount: ledgerEntries.amount,
    })
    .from(ledgerEntries)
    .where(
      and(
        businessId ? eq(ledgerEntries.businessId, businessId) : undefined,
        gte(ledgerEntries.createdAt, start),
        isNull(ledgerEntries.voidedAt),
        isNull(ledgerEntries.reversalOfId),
      ),
    )
    .as("entries_with_month");

  const rows = await db
    .select({
      month: sql<string>`to_char(${entriesWithMonth.month}, 'YYYY-MM')`,
      debt: sql<string>`coalesce(sum(case when ${entriesWithMonth.type} = 'DEBT' then ${entriesWithMonth.amount} else 0 end), 0)::bigint`,
      payment: sql<string>`coalesce(sum(case when ${entriesWithMonth.type} = 'PAYMENT' then ${entriesWithMonth.amount} else 0 end), 0)::bigint`,
    })
    .from(entriesWithMonth)
    .groupBy(entriesWithMonth.month)
    .orderBy(entriesWithMonth.month);

  const byMonth = new Map(rows.map((row) => [row.month, row]));

  // Se rellenan los meses sin movimientos para que la gráfica sea continua.
  const points: MonthlyFlowPoint[] = [];
  for (let index = 0; index < months; index++) {
    const date = new Date(
      Date.UTC(
        startLocal.getUTCFullYear(),
        startLocal.getUTCMonth() + index,
        1,
      ),
    );

    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const row = byMonth.get(month);

    points.push({
      month,
      label: `${MONTH_LABELS[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(2)}`,
      debtCents: Number(row?.debt ?? 0),
      paymentCents: Number(row?.payment ?? 0),
    });
  }

  return points;
}

// Saldo por cliente. Incluye clientes sin movimientos (montos en cero).
export async function listCustomerBalances(
  businessId: string,
): Promise<CustomerWithBalance[]> {
  const rows = await db
    .select({
      id: customers.id,
      debt: sql<string>`coalesce(sum(case when ${ledgerEntries.type} = 'DEBT' then ${ledgerEntries.amount} else 0 end), 0)::bigint`,
      payment: sql<string>`coalesce(sum(case when ${ledgerEntries.type} = 'PAYMENT' then ${ledgerEntries.amount} else 0 end), 0)::bigint`,
      // Se seleccionan todas las columnas del cliente vía subconsulta de fila.
      customer: customers,
    })
    .from(customers)
    .leftJoin(
      ledgerEntries,
      and(
        eq(ledgerEntries.customerId, customers.id),
        eq(ledgerEntries.businessId, businessId),
        isNull(ledgerEntries.voidedAt),
        isNull(ledgerEntries.reversalOfId),
      ),
    )
    .where(eq(customers.businessId, businessId))
    .groupBy(customers.id)
    .orderBy(asc(customers.firstName), asc(customers.lastName));

  return rows.map((row) => {
    const debtCents = Number(row.debt);
    const paymentCents = Number(row.payment);

    return {
      ...row.customer,
      customerId: row.customer.id,
      debtCents,
      paymentCents,
      balanceCents: paymentCents - debtCents,
      outstandingCents: debtCents - paymentCents,
    };
  });
}
