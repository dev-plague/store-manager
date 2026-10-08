# Store Manager

Aplicación web para **gestionar las deudas y créditos de clientes** en tiendas
locales: registro de clientes, registro de deudas y abonos (pagos parciales o
totales), y cálculo preciso de saldos individuales y globales.

## Pila tecnológica

| Área            | Tecnología                                              |
| --------------- | ------------------------------------------------------- |
| Framework       | React Router v8 (SSR, Loaders/Actions, middleware)      |
| Autenticación   | Better Auth (email + contraseña)                        |
| Base de datos   | PostgreSQL (Docker)                                     |
| ORM             | Drizzle ORM + Drizzle Kit                               |
| Estilos         | Tailwind CSS v4 (Mobile-First) + shadcn/ui              |
| Notificaciones  | [sileo](https://github.com/hiaaryan/sileo)              |
| Gráficas        | Recharts                                                |
| PWA             | manifest + service worker + iconos                      |
| Runtime / paquetes | Bun                                                 |
| Validación      | Zod                                                     |

## Puesta en marcha

```bash
# 0. Instalar Bun (si aún no lo tienes): https://bun.sh
#    curl -fsSL https://bun.sh/install | bash

# 1. Instalar dependencias
bun install

# 2. Variables de entorno
cp .env.example .env
# Genera un secreto: openssl rand -base64 32

# 3. Levantar PostgreSQL
bun run db:start

# 4. Generar y aplicar migraciones
bun run db:generate
bun run db:migrate

# 5. (Opcional) Datos de ejemplo
bun run db:seed

# 6. Desarrollo
bun run dev
```

Credenciales de ejemplo creadas por el seed:

- Superadmin: `admin@store-manager.local` / `superadmin1234`
- Encargado: `encargado@store-manager.local` / `encargado1234`

## Estructura del proyecto

```
app/
├── db/
│   ├── client.server.ts        # Conexión Drizzle (pool de PostgreSQL)
│   ├── seed.server.ts          # Datos de ejemplo
│   └── schema/
│       ├── enums.ts            # Enums (DEBT / PAYMENT)
│       ├── businesses.ts       # Tiendas (raíz multi-tenant)
│       ├── auth.ts             # Tablas de Better Auth (users, sessions, ...)
│       ├── customers.ts        # Clientes
│       ├── ledger-entries.ts   # Libro mayor (transacciones inmutables)
│       ├── user-permissions.ts # Permisos granulares por usuario
│       ├── relations.ts        # Relaciones de Drizzle
│       └── index.ts            # Barrel del esquema
├── features/                   # Lógica de dominio por característica
│   ├── businesses/services/    # Tiendas: CRUD y listado con métricas
│   ├── customers/services/     # CRUD de clientes (scoped por business_id)
│   ├── ledger/services/        # Deudas, abonos y cálculo de saldos
│   ├── users/services/         # Usuarios y permisos por tienda
│   ├── reports/                # Informes por rango de fechas + export CSV
│   │   ├── report-range.ts     # Parseo/validación del rango (from/to)
│   │   └── services/           # Resumen, movimientos y desglose por cliente
│   └── metrics/
│       ├── services/           # Métricas, saldos y flujo mensual
│       └── components/         # Gráficas (Recharts)
├── lib/
│   ├── auth.server.ts          # Configuración de Better Auth
│   ├── auth-client.ts          # Cliente de Better Auth (navegador)
│   ├── business-context.server.ts # Tienda activa del Superadmin (cookie)
│   ├── env.server.ts           # Validación de variables de entorno (Zod)
│   ├── money.ts                # Conversión y formato de montos (centavos)
│   ├── csv.ts                  # Generación de CSV (BOM UTF-8)
│   ├── permissions.ts          # Catálogo de permisos granulares
│   ├── session.server.ts       # getAuthContext + guards (auth/permisos)
│   └── utils.ts                # cn() para shadcn/ui
├── routes/                     # Rutas (UI en español)
├── types/                      # Tipos de dominio derivados del esquema
├── components/
│   ├── money-input.tsx         # Entrada de dinero con separador de miles (visual)
│   ├── mobile-nav.tsx          # Barra de navegación inferior (móvil)
│   ├── customer-search.tsx     # Búsqueda de clientes con autocompletado
│   └── flash-toast.tsx         # Notificación tras un redirect (?flash=)
├── context.ts                  # Contexto de React Router para la sesión
├── root.tsx                    # Layout raíz + Toaster de sileo
├── routes.ts                   # Configuración de rutas
└── app.css                     # Tailwind + tokens de shadcn/ui

public/                         # Assets estáticos (PWA: manifest, service worker, iconos)
drizzle/                        # Migraciones generadas
```

## Reglas de negocio

### Multi-tenancy

- Una sola base de datos con aislamiento **por fila** mediante `business_id`.
- Todas las tablas de negocio incluyen `business_id` (obligatorio e indexado).
- Cada consulta/mutación valida explícitamente el `business_id` tomado del
  contexto de sesión (`app/context.ts` → `app/lib/session.server.ts`).

### Contabilidad (ledger)

- Las deudas y pagos se registran como **entradas inmutables** en
  `ledger_entries`; nunca se editan ni eliminan.
- **Correcciones (contra-asiento)**: para arreglar un error no se modifica la
  entrada. Con el permiso `ledger:adjust` se marca la original como anulada
  (`voided_at` / `voided_by`) y se inserta un **reverso** (tipo opuesto, mismo
  monto, `reversal_of_id`); si es una **corrección**, además se inserta la nueva
  entrada. El historial completo se conserva y los agregados/saldos ignoran las
  entradas anuladas y sus reversos, de modo que solo cuentan las vigentes.
- **No se puede abonar más de lo que se debe**: un abono, una corrección o una
  anulación no pueden dejar el saldo pendiente en negativo. La validación se
  aplica en el servidor (`ledger.server.ts`) y devuelve un error claro.
- Los montos se guardan como **enteros en centavos** (`integer`) para evitar
  errores de punto flotante. Siempre positivos: el campo `type` define la
  dirección.
- Entradas requeridas: `id`, `business_id`, `customer_id`, `amount`, `type`
  (`DEBT` / `PAYMENT`), `description`, `created_at`, `created_by`.
- Saldo del cliente:

  ```
  balanceCents     = SUM(PAYMENT) - SUM(DEBT)
  outstandingCents = SUM(DEBT) - SUM(PAYMENT)   // deuda pendiente (positiva si debe)
  ```

### Permisos (RBAC granular)

- No hay roles rígidos: se conceden **permisos granulares** por usuario
  (`customers:create`, `payments:create`, `ledger:adjust`, `metrics:read`, ...).
- Catálogo único en `app/lib/permissions.ts`; persistidos en `user_permissions`.
- El **Administrador Global (Superadmin)** no tiene `business_id` y omite todas
  las comprobaciones de permisos. Ve un **panel global** (métricas y gráficas de
  todas las tiendas) y elige una **tienda activa** (cookie `sm_active_business`)
  para operar sobre ella.

### Gestión de tiendas y usuarios

- **Tiendas** (`businesses:manage`, exclusivo del Administrador Global para
  crear/eliminar): crear, editar, activar/desactivar y eliminar. Una tienda solo
  se puede eliminar si **no tiene usuarios** asignados (si los tiene, se bloquea
  para evitar cuentas huérfanas; se sugiere desactivarla).
- **Usuarios** (`users:manage`): crear usuarios dentro de la tienda y asignar sus
  permisos granulares por casillas. Un usuario de tienda **no puede otorgar
  permisos globales** (`businesses:manage`); la UI y el servidor los filtran.
- **Restablecer contraseña** (`users:manage`): un administrador puede fijar una
  nueva contraseña a un usuario de su tienda sin conocer la actual. Se cierran
  sus sesiones activas para forzar el reingreso. Se reutiliza el mecanismo
  interno de Better Auth (`ctx.password.hash` + `internalAdapter.updatePassword`,
  el mismo que usa el plugin `admin`) para no introducir roles rígidos.
- Todas las operaciones de usuarios validan el `business_id` de la tienda activa.

### Informes y exportación

- Ruta `/dashboard/reports` (permiso `metrics:read`, tienda activa). Filtra por
  rango de fechas (`?from=YYYY-MM-DD&to=YYYY-MM-DD`, por defecto el mes actual) y
  muestra resumen (movimientos, deudas, abonos, neto, pendiente), desglose por
  cliente y el detalle de movimientos vigentes.
- Exportación **CSV** en `/dashboard/reports/export?from=&to=&format=movements|customers`
  (mismo permiso y aislamiento). El CSV lleva BOM UTF-8 para Excel; los montos
  van en unidades de la moneda con 2 decimales.
- UI móvil simplificada: **filtros colapsables**, **botones solo con icono** para
  las descargas (una por sección) y, tras el resumen, **tabs** para separar
  «Por cliente» y «Movimientos» (solo se muestra una lista a la vez). El desglose
  por cliente se muestra como lista, no como tabla.
- **Búsqueda de clientes por nombre**: en clientes filtra la lista al escribir; en
  informes usa **autocompletado** y filtra todo el informe por el cliente elegido
  (`?customerId=`).

### Moneda

- Moneda por defecto: **COP** (peso colombiano), locale `es-CO`.
- Los montos se guardan en la unidad mínima (centavos); `Intl` muestra los
  decimales que correspondan a cada moneda (COP: 0 decimales).

## Convenciones

- **Código** (variables, funciones, tipos, tablas, archivos): inglés.
- **Comentarios y documentación**: español.
- **Interfaz de usuario**: español.

## Componentes UI (shadcn/ui)

El proyecto ya está configurado (`components.json`, tokens en `app.css`,
`cn()` en `app/lib/utils.ts`). Para añadir componentes:

```bash
bunx shadcn@latest add button card input
```

## Scripts

| Comando              | Descripción                                 |
| -------------------- | ------------------------------------------- |
| `bun run dev`        | Servidor de desarrollo                      |
| `bun run build`      | Compilar para producción                    |
| `bun run start`      | Servir la compilación                       |
| `bun run typecheck`  | Generar tipos de rutas + comprobar TypeScript |
| `bun run db:start`   | Levantar PostgreSQL (Docker)                |
| `bun run db:stop`    | Detener PostgreSQL                          |
| `bun run db:generate`| Generar migraciones                         |
| `bun run db:migrate` | Aplicar migraciones                         |
| `bun run db:push`    | Sincronizar esquema (desarrollo)            |
| `bun run db:studio`  | Abrir Drizzle Studio                        |
| `bun run db:seed`    | Cargar datos de ejemplo                     |
