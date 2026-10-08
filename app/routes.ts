import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

// Configuración explícita de rutas (framework mode).
// En español se muestran las URLs; el nombre de archivos/componentes va en inglés.
export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  // Silencia la petición automática de Chrome DevTools.
  route(
    ".well-known/appspecific/com.chrome.devtools.json",
    "routes/well-known.devtools.ts",
  ),
  // Establece la tienda activa del Administrador Global.
  route("select-business", "routes/select-business.tsx"),

  // Todas las rutas hijas heredan el middleware de autenticación.
  layout("routes/dashboard.tsx", [
    route("dashboard", "routes/dashboard.home.tsx"),
    route("dashboard/customers", "routes/dashboard.customers.tsx"),
    route("dashboard/customers/new", "routes/dashboard.customer-new.tsx"),
    route("dashboard/customers/:customerId", "routes/dashboard.customer.tsx"),
    route("dashboard/businesses", "routes/dashboard.businesses.tsx"),
    route("dashboard/businesses/new", "routes/dashboard.business-new.tsx"),
    route("dashboard/businesses/:businessId", "routes/dashboard.business.tsx"),
    route("dashboard/users", "routes/dashboard.users.tsx"),
    route("dashboard/users/new", "routes/dashboard.user-new.tsx"),
    route("dashboard/users/:userId", "routes/dashboard.user.tsx"),
    route("dashboard/reports", "routes/dashboard.reports.tsx"),
    route("dashboard/reports/export", "routes/reports-export.ts"),
  ]),
] satisfies RouteConfig;
