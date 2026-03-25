import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SalesChart({ data }) {
  return (
    <div className="pg-card rounded-3xl p-5">
      <div className="mb-4">
        <h3 className="pg-display text-2xl text-[var(--pg-deep)]">Ventas diarias</h3>
        <p className="text-sm text-[var(--pg-charcoal)]/58">Evolución de ingresos por día</p>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="pgRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#028436" stopOpacity={0.34} />
                <stop offset="95%" stopColor="#028436" stopOpacity={0.04} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,72,59,0.12)" />
            <XAxis dataKey="date" stroke="rgba(32,33,36,0.55)" />
            <YAxis stroke="rgba(32,33,36,0.55)" tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#00483b"
              strokeWidth={3}
              fill="url(#pgRevenue)"
              dot={{ r: 4, fill: "#028436", stroke: "#00483b", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: "#028436", stroke: "#00483b", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}