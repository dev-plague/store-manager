import { eq } from "drizzle-orm";
import { db } from "~/db/client.server";
import {
  businesses,
  customers as customersTable,
  ledgerEntries,
  userPermissions,
  users,
} from "~/db/schema";
import { auth } from "~/lib/auth.server";
import { createCustomer } from "~/features/customers/services/customer.server";

// Script de datos de ejemplo.
//   bun run db:seed
// Crea un Superadmin, una tienda (COP), un encargado con permisos y clientes
// con movimientos repartidos en varios meses para alimentar las gráficas.
// Es idempotente: vuelve a crear clientes y movimientos en cada ejecución.

async function upsertUser(input: {
  email: string;
  password: string;
  name: string;
  businessId: string | null;
  isSuperadmin: boolean;
}) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existing[0]) {
    await db
      .update(users)
      .set({
        businessId: input.businessId,
        isSuperadmin: input.isSuperadmin,
      })
      .where(eq(users.id, existing[0].id));
    return existing[0].id;
  }

  // Better Auth crea el usuario y hashea la contraseña.
  await auth.api.signUpEmail({
    body: {
      email: input.email,
      password: input.password,
      name: input.name,
    },
  });

  const [created] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (!created) throw new Error("No se pudo crear el usuario " + input.email);

  await db
    .update(users)
    .set({
      businessId: input.businessId,
      isSuperadmin: input.isSuperadmin,
    })
    .where(eq(users.id, created.id));

  return created.id;
}

// Fecha dentro de un mes anterior, para repartir movimientos en el tiempo.
function monthsAgo(months: number, day: number): Date {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - months);
  date.setDate(day);
  date.setHours(12, 0, 0, 0);
  return date;
}

async function main() {
  console.log("Sembrando datos de ejemplo...");

  const [business] = await db
    .insert(businesses)
    .values({
      name: "Tienda Doña Rosa",
      slug: "tienda-dona-rosa",
      currency: "COP",
      timezone: "America/Bogota",
    })
    .onConflictDoUpdate({
      target: businesses.slug,
      set: {
        name: "Tienda Doña Rosa",
        currency: "COP",
        timezone: "America/Bogota",
      },
    })
    .returning();

  const businessId = business!.id;

  const superadminId = await upsertUser({
    email: "admin@store-manager.local",
    password: "superadmin1234",
    name: "Administrador Global",
    businessId: null,
    isSuperadmin: true,
  });

  const managerId = await upsertUser({
    email: "encargado@store-manager.local",
    password: "encargado1234",
    name: "Encargada de Tienda",
    businessId,
    isSuperadmin: false,
  });

  // Permisos granulares del encargado.
  const granted = [
    "customers:create",
    "customers:read",
    "customers:update",
    "debts:create",
    "debts:read",
    "payments:create",
    "payments:read",
    "ledger:adjust",
    "metrics:read",
    "users:manage",
  ] as const;

  await db
    .insert(userPermissions)
    .values(
      granted.map((permission) => ({
        businessId,
        userId: managerId,
        permission,
        grantedBy: superadminId,
      })),
    )
    .onConflictDoNothing();

  // Borrado lógico-para-demo: se reinician clientes (cascade borra el ledger).
  await db.delete(customersTable).where(eq(customersTable.businessId, businessId));

  const createdCustomers = await Promise.all([
    createCustomer({
      businessId,
      firstName: "Juan",
      lastName: "Pérez",
      phone: "300 555 0101",
      createdBy: managerId,
    }),
    createCustomer({
      businessId,
      firstName: "María",
      lastName: "Gómez",
      phone: "310 555 0202",
      createdBy: managerId,
    }),
    createCustomer({
      businessId,
      firstName: "Carlos",
      lastName: "Rodríguez",
      phone: "320 555 0303",
      createdBy: managerId,
    }),
  ]);

  const [juan, maria, carlos] = createdCustomers;

  // Montos en centavos (1 COP = 100 centavos): 12.000.000 = $120.000 COP.
  await db.insert(ledgerEntries).values([
    {
      businessId,
      customerId: juan!.id,
      amount: 12000000,
      type: "DEBT",
      description: "Mercado fiado",
      createdBy: managerId,
      createdAt: monthsAgo(4, 10),
    },
    {
      businessId,
      customerId: juan!.id,
      amount: 4000000,
      type: "PAYMENT",
      description: "Abono parcial",
      createdBy: managerId,
      createdAt: monthsAgo(3, 18),
    },
    {
      businessId,
      customerId: juan!.id,
      amount: 5000000,
      type: "DEBT",
      description: "Compra fiada",
      createdBy: managerId,
      createdAt: monthsAgo(1, 5),
    },
    {
      businessId,
      customerId: juan!.id,
      amount: 2000000,
      type: "PAYMENT",
      description: "Abono",
      createdBy: managerId,
      createdAt: monthsAgo(0, 8),
    },
    {
      businessId,
      customerId: maria!.id,
      amount: 8000000,
      type: "DEBT",
      description: "Compra fiada",
      createdBy: managerId,
      createdAt: monthsAgo(2, 12),
    },
    {
      businessId,
      customerId: maria!.id,
      amount: 3000000,
      type: "PAYMENT",
      description: "Abono",
      createdBy: managerId,
      createdAt: monthsAgo(0, 3),
    },
    {
      businessId,
      customerId: carlos!.id,
      amount: 3500000,
      type: "DEBT",
      description: "Compra fiada",
      createdBy: managerId,
      createdAt: monthsAgo(0, 2),
    },
    {
      businessId,
      customerId: carlos!.id,
      amount: 1000000,
      type: "PAYMENT",
      description: "Abono inicial",
      createdBy: managerId,
      createdAt: monthsAgo(0, 6),
    },
  ]);

  console.log("Listo. Usuarios:");
  console.log("  Superadmin: admin@store-manager.local / superadmin1234");
  console.log("  Encargado:  encargado@store-manager.local / encargado1234");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
