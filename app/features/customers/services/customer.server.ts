import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "~/db/client.server";
import { customers } from "~/db/schema";
import type { Customer } from "~/types";

// Acceso a datos de clientes. TODAS las funciones exigen y filtran por
// `businessId` para garantizar el aislamiento multi-tenant.

export type CreateCustomerInput = {
  businessId: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  createdBy: string;
};

export type UpdateCustomerInput = Partial<
  Pick<
    Customer,
    "firstName" | "lastName" | "phone" | "email" | "address" | "notes" | "isActive"
  >
>;

// Lista clientes de una tienda, con búsqueda opcional por nombre/teléfono/email.
export async function listCustomers(
  businessId: string,
  search?: string,
): Promise<Customer[]> {
  const term = search?.trim();

  return db
    .select()
    .from(customers)
    .where(
      term
        ? and(
            eq(customers.businessId, businessId),
            or(
              ilike(customers.firstName, `%${term}%`),
              ilike(customers.lastName, `%${term}%`),
              ilike(customers.phone, `%${term}%`),
              ilike(customers.email, `%${term}%`),
            ),
          )
        : eq(customers.businessId, businessId),
    )
    .orderBy(asc(customers.firstName), asc(customers.lastName));
}

// Recupera un cliente validando que pertenezca a la tienda.
export async function getCustomerById(
  businessId: string,
  customerId: string,
): Promise<Customer | null> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(
      and(eq(customers.id, customerId), eq(customers.businessId, businessId)),
    )
    .limit(1);

  return customer ?? null;
}

// Crea un cliente dentro de una tienda.
export async function createCustomer(
  input: CreateCustomerInput,
): Promise<Customer> {
  const [customer] = await db
    .insert(customers)
    .values({
      businessId: input.businessId,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      createdBy: input.createdBy,
    })
    .returning();

  return customer;
}

// Actualiza un cliente validando el aislamiento por tienda.
export async function updateCustomer(
  businessId: string,
  customerId: string,
  changes: UpdateCustomerInput,
): Promise<Customer | null> {
  const [customer] = await db
    .update(customers)
    .set(changes)
    .where(
      and(eq(customers.id, customerId), eq(customers.businessId, businessId)),
    )
    .returning();

  return customer ?? null;
}

// Desactiva (borrado lógico) un cliente para preservar el historial contable.
export async function desactivateCustomer(
  businessId: string,
  customerId: string,
): Promise<Customer | null> {
  return updateCustomer(businessId, customerId, { isActive: false });
}

// Utilidad para exportaciones/paginación futuras.
export const customerOrder = (direction: "asc" | "desc" = "asc") =>
  direction === "asc" ? asc(customers.lastName) : desc(customers.lastName);

export type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
};

// Lista ligera de clientes (id, nombre, teléfono) para autocompletado en el cliente.
export async function listCustomerOptions(
  businessId: string,
): Promise<CustomerOption[]> {
  const rows = await db
    .select({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      phone: customers.phone,
    })
    .from(customers)
    .where(eq(customers.businessId, businessId))
    .orderBy(asc(customers.firstName), asc(customers.lastName));

  return rows.map((row) => ({
    id: row.id,
    name: `${row.firstName} ${row.lastName}`,
    phone: row.phone,
  }));
}
