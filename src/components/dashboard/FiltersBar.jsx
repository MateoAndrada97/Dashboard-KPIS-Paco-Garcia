export default function FiltersBar({ filters, setFilters, options }) {
  const handleChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="pg-card rounded-3xl p-5">
      <div className="mb-4">
        <h3 className="pg-display text-2xl text-[var(--pg-deep)]">Filtros</h3>
        <p className="text-sm text-[var(--pg-charcoal)]/58">
          Estado, fecha, ciudad, provincia, courrier y medio de pago.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        <div>
          <label className="mb-1 block text-sm text-[var(--pg-deep)]/78">Estado</label>
          <select
            value={filters.status}
            onChange={(e) => handleChange("status", e.target.value)}
            className="pg-select w-full rounded-2xl px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            {(options.statuses || []).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--pg-deep)]/78">Desde</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleChange("dateFrom", e.target.value)}
            className="pg-input w-full rounded-2xl px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--pg-deep)]/78">Hasta</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleChange("dateTo", e.target.value)}
            className="pg-input w-full rounded-2xl px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--pg-deep)]/78">Ciudad</label>
          <select
            value={filters.city}
            onChange={(e) => handleChange("city", e.target.value)}
            className="pg-select w-full rounded-2xl px-3 py-2 text-sm"
          >
            <option value="all">Todas</option>
            {(options.cities || []).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--pg-deep)]/78">Provincia</label>
          <select
            value={filters.state}
            onChange={(e) => handleChange("state", e.target.value)}
            className="pg-select w-full rounded-2xl px-3 py-2 text-sm"
          >
            <option value="all">Todas</option>
            {(options.states || []).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--pg-deep)]/78">Courrier</label>
          <select
            value={filters.courrier}
            onChange={(e) => handleChange("courrier", e.target.value)}
            className="pg-select w-full rounded-2xl px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            {(options.courriers || []).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--pg-deep)]/78">Medio de pago</label>
          <select
            value={filters.paymentMethod}
            onChange={(e) => handleChange("paymentMethod", e.target.value)}
            className="pg-select w-full rounded-2xl px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            {(options.paymentMethods || []).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}