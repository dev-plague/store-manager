import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export type CustomerSuggestion = {
  id: string;
  name: string;
  phone: string | null;
};

// Normaliza para comparar sin acentos ni mayúsculas.
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

// Campo de búsqueda de clientes con autocompletado.
// Filtra en el cliente la lista recibida por props (sin peticiones por tecla).
export function CustomerSearch({
  customers,
  onSelect,
  placeholder = "Buscar cliente por nombre",
}: {
  customers: CustomerSuggestion[];
  onSelect: (customer: CustomerSuggestion) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const term = normalize(query.trim());

  const results = useMemo(() => {
    if (term.length < 2) return [];
    return customers
      .filter((customer) => normalize(customer.name).includes(term))
      .slice(0, 8);
  }, [customers, term]);

  // Cierra el desplegable al hacer clic fuera.
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function choose(customer: CustomerSuggestion) {
    onSelect(customer);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results[0]) {
              event.preventDefault();
              choose(results[0]);
            }
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-12 rounded-xl pr-12 pl-10 text-base"
        />
        {query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            aria-label="Limpiar búsqueda"
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      {open && results.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border bg-popover shadow-lg">
          {results.map((customer) => (
            <li key={customer.id}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => choose(customer)}
                className="h-auto w-full justify-between gap-3 rounded-none px-4 py-3 text-left text-base font-normal"
              >
                <span className="min-w-0 truncate font-medium">
                  {customer.name}
                </span>
                {customer.phone ? (
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {customer.phone}
                  </span>
                ) : null}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {open && term.length >= 2 && results.length === 0 ? (
        <div className="absolute z-20 mt-1 w-full rounded-xl border bg-popover px-4 py-3 text-base text-muted-foreground shadow-lg">
          Sin resultados
        </div>
      ) : null}
    </div>
  );
}
