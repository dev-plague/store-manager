import { redirect } from "react-router";
import { auth } from "~/lib/auth.server";
import type { Route } from "./+types/logout";

// Cierra la sesión reenviando la cookie de limpieza que emite Better Auth.
export async function action({ request }: Route.ActionArgs) {
  const response = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });

  const setCookie = response.headers.get("set-cookie");
  return redirect(
    "/login",
    setCookie ? { headers: { "Set-Cookie": setCookie } } : undefined,
  );
}

// Un GET directo a /logout también cierra la sesión por comodidad.
export async function loader() {
  return redirect("/dashboard");
}
