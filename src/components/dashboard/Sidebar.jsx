import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Building2,
  DollarSign,
  Lightbulb,
} from "lucide-react";

const items = [
  { label: "Resumen", icon: LayoutDashboard, active: true },
  { label: "Ventas", icon: ShoppingCart },
  { label: "Productos", icon: Package },
  { label: "Sucursales", icon: Building2 },
  { label: "Costos y margen", icon: DollarSign },
  { label: "Plan de mejoras", icon: Lightbulb },
];

export default function Sidebar() {
  return (
    <aside className="flex min-h-screen w-full flex-col bg-[var(--pg-deep)] text-white">
      <div className="border-b border-white/10 px-6 py-8">
        <div className="pg-display text-4xl leading-none">paco garcia</div>
        <p className="mt-3 text-xs uppercase tracking-[0.24em] text-white/70">
          Dashboard · 2026
        </p>
      </div>

      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label}>
                <button
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${
                    item.active
                      ? "bg-[var(--pg-green)] text-white shadow-lg shadow-black/10"
                      : "text-white/84 hover:bg-white/8"
                  }`}
                >
                  <Icon size={16} />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 px-6 py-4">
        <p className="text-xs uppercase tracking-[0.18em] text-white/55">
          Somos movimiento
        </p>
      </div>
    </aside>
  );
}