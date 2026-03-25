function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProductsTable({ products = [], title = "Top 10 productos más vendidos" }) {
  return (
    <div className="pg-card rounded-3xl p-5">
      <div className="mb-4">
        <h3 className="pg-display text-2xl text-[var(--pg-deep)]">{title}</h3>
        <p className="text-sm text-[var(--pg-charcoal)]/58">Ordenado por unidades vendidas.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-[var(--pg-light)] text-left text-sm text-[var(--pg-deep)]/74">
              <th className="rounded-l-2xl px-4 py-3">Producto</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Unidades</th>
              <th className="rounded-r-2xl px-4 py-3">Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="text-sm text-[var(--pg-charcoal)]">
                <td className="border-b border-[rgba(0,72,59,0.08)] px-4 py-4 font-medium">
                  {product.name}
                </td>
                <td className="border-b border-[rgba(0,72,59,0.08)] px-4 py-4">
                  {product.category}
                </td>
                <td className="border-b border-[rgba(0,72,59,0.08)] px-4 py-4">
                  {product.units}
                </td>
                <td className="border-b border-[rgba(0,72,59,0.08)] px-4 py-4">
                  {formatCurrency(product.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}