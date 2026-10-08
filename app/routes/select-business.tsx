import { redirect } from "react-router";
import { z } from "zod";
import { getBusinessById } from "~/features/businesses/services/business.server";
import {
	clearActiveBusinessCookie,
	setActiveBusinessCookie,
} from "~/lib/business-context.server";
import { assertAuthenticated, getAuthContext } from "~/lib/session.server";
import type { Route } from "./+types/select-business";

const businessIdSchema = z.uuid();

// Establece (o limpia) la tienda activa del Administrador Global.
export async function action({ request }: Route.ActionArgs) {
	const auth = await getAuthContext(request);
	assertAuthenticated(auth);

	if (!auth.isSuperadmin) {
		throw new Response("No autorizado.", { status: 403 });
	}

	const form = await request.formData();
	const rawBusinessId = String(form.get("businessId") ?? "").trim();

	// Sin tienda: se limpia la cookie y se vuelve al panel global.
	if (!rawBusinessId) {
		return redirect("/dashboard", {
			headers: { "Set-Cookie": await clearActiveBusinessCookie() },
		});
	}

	const parsed = businessIdSchema.safeParse(rawBusinessId);
	if (!parsed.success) {
		throw new Response("Tienda inválida.", { status: 400 });
	}

	const business = await getBusinessById(parsed.data);
	if (!business) {
		throw new Response("Tienda no encontrada.", { status: 404 });
	}

	const redirectTo = String(form.get("redirectTo") ?? "/dashboard/customers");

	return redirect(redirectTo, {
		headers: { "Set-Cookie": await setActiveBusinessCookie(business.id) },
	});
}

export async function loader() {
	return redirect("/dashboard");
}
