import { Link } from "react-router";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Gestor de Tienda" },
    {
      name: "description",
      content: "Registra clientes, deudas y abonos de tu tienda local.",
    },
  ];
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 p-6">
      <header className="space-y-3">
        <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Gestión de fiados
        </span>
        <h1 className="text-4xl font-bold tracking-tight">Gestor de Tienda</h1>
        <p className="text-muted-foreground">
          Controla deudas y créditos de tus clientes de forma precisa.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <Link
          to="/login"
          className="rounded-xl bg-primary px-4 py-3 text-center font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Iniciar sesión
        </Link>
        <Link
          to="/dashboard"
          className="rounded-xl border px-4 py-3 text-center font-medium transition-colors hover:bg-muted"
        >
          Ir al panel
        </Link>
      </div>
    </main>
  );
}
