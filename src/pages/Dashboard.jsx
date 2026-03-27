import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import KpiCard from "../components/dashboard/KpiCard";
import SalesChart from "../components/dashboard/SalesChart";
import ProductsTable from "../components/dashboard/ProductsTable";
import UploadVTEX from "../components/dashboard/UploadVTEX";
import FiltersBar from "../components/dashboard/FiltersBar";
import { mockData } from "../data/mockData";
import {
  parseVTEXFile,
  adaptVTEXRows,
  buildDashboardMetrics,
} from "../lib/vtexAdapters";

function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonthKey(monthKey) {
  if (!monthKey) return "Sin datos";
  const [year, month] = monthKey.split("-");
  return `${month}/${year}`;
}

function formatDateTime(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function Dashboard() {
  const [baseData, setBaseData] = useState(null);
  const [activeReport, setActiveReport] = useState(null);
  const [reportHistory, setReportHistory] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSwitchingReport, setIsSwitchingReport] = useState(false);

  const [filters, setFilters] = useState({
    status: "all",
    dateFrom: "",
    dateTo: "",
    city: "all",
    state: "all",
    courrier: "all",
    paymentMethod: "all",
  });

  const loadActiveReport = async () => {
    const response = await fetch("/api/report", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("No se pudo obtener el reporte activo.");
    }

    const payload = await response.json();

    if (payload?.report?.report_data) {
      setBaseData(payload.report.report_data);
      setActiveReport(payload.report);
    } else {
      setBaseData(null);
      setActiveReport(null);
    }
  };

  const loadReportHistory = async () => {
    const response = await fetch("/api/report?history=1", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("No se pudo obtener el historial.");
    }

    const payload = await response.json();
    setReportHistory(payload?.reports || []);
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const [activeResponse, historyResponse] = await Promise.all([
          fetch("/api/report", { method: "GET", cache: "no-store" }),
          fetch("/api/report?history=1", { method: "GET", cache: "no-store" }),
        ]);

        if (!activeResponse.ok) {
          throw new Error("No se pudo obtener el reporte activo.");
        }

        if (!historyResponse.ok) {
          throw new Error("No se pudo obtener el historial.");
        }

        const activePayload = await activeResponse.json();
        const historyPayload = await historyResponse.json();

        if (cancelled) return;

        if (activePayload?.report?.report_data) {
          setBaseData(activePayload.report.report_data);
          setActiveReport(activePayload.report);
        } else {
          setBaseData(null);
          setActiveReport(null);
        }

        setReportHistory(historyPayload?.reports || []);
      } catch (error) {
        console.error("Error cargando reportes:", error);
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleFileChange = async (file) => {
    if (!file) return;

    try {
      setIsUploading(true);

      const rows = await parseVTEXFile(file);
      const adapted = adaptVTEXRows(rows);

      const response = await fetch("/api/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportName: file.name,
          uploadedBy: "manual",
          reportData: adapted,
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo guardar el reporte en Supabase.");
      }

      const payload = await response.json();

      setBaseData(adapted);
      setActiveReport(payload.report || null);
      await loadReportHistory();
    } catch (error) {
      console.error("Error procesando o guardando archivo VTEX:", error);
      alert("No se pudo procesar o guardar el archivo CSV.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleActivateReport = async (reportId) => {
    try {
      setIsSwitchingReport(true);

      const response = await fetch("/api/report", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reportId }),
      });

      if (!response.ok) {
        throw new Error("No se pudo reactivar el reporte.");
      }

      const payload = await response.json();

      if (payload?.report?.report_data) {
        setBaseData(payload.report.report_data);
        setActiveReport(payload.report);
      }

      await loadReportHistory();
    } catch (error) {
      console.error("Error reactivando reporte:", error);
      alert("No se pudo reactivar el reporte seleccionado.");
    } finally {
      setIsSwitchingReport(false);
    }
  };

  const filterOptions = useMemo(() => {
    if (!baseData) {
      return {
        statuses: [],
        cities: [],
        states: [],
        courriers: [],
        paymentMethods: [],
      };
    }

    const unique = (arr) => [...new Set(arr.filter(Boolean))].sort();

    return {
      statuses: unique(baseData.uniqueOrders.map((o) => o.status)),
      cities: unique(baseData.uniqueOrders.map((o) => o.city)),
      states: unique(baseData.uniqueOrders.map((o) => o.state)),
      courriers: unique(baseData.uniqueOrders.map((o) => o.courrier)),
      paymentMethods: unique(baseData.uniqueOrders.map((o) => o.paymentMethod)),
    };
  }, [baseData]);

  const filteredOrders = useMemo(() => {
    if (!baseData) return [];

    return baseData.uniqueOrders.filter((order) => {
      const rawDate = order.creationDate?.slice(0, 10) || "";
      const fromOk = !filters.dateFrom || rawDate >= filters.dateFrom;
      const toOk = !filters.dateTo || rawDate <= filters.dateTo;

      const statusOk = filters.status === "all" || order.status === filters.status;
      const cityOk = filters.city === "all" || order.city === filters.city;
      const stateOk = filters.state === "all" || order.state === filters.state;
      const courrierOk = filters.courrier === "all" || order.courrier === filters.courrier;
      const paymentOk =
        filters.paymentMethod === "all" || order.paymentMethod === filters.paymentMethod;

      return fromOk && toOk && statusOk && cityOk && stateOk && courrierOk && paymentOk;
    });
  }, [baseData, filters]);

  const filteredRows = useMemo(() => {
    if (!baseData) return [];

    const validOrders = new Set(filteredOrders.map((order) => order.order));
    return baseData.rows.filter((row) => validOrders.has(row.order));
  }, [baseData, filteredOrders]);

  const metrics = useMemo(() => {
    if (!baseData) {
      const totalRevenue = mockData.salesDaily.reduce((acc, item) => acc + item.revenue, 0);
      const totalOrders = mockData.salesDaily.reduce((acc, item) => acc + item.orders, 0);

      return {
        totalRevenue,
        totalOrders,
        avgTicket: totalOrders ? totalRevenue / totalOrders : 0,
        salesDaily: mockData.salesDaily,
        topProducts: mockData.products.slice(0, 10),
        bestCategory: null,
        topClients: mockData.topClients,
        topProductsCurrentMonth: mockData.products.slice(0, 10),
        topProductsPreviousMonth: mockData.products.slice(0, 10),
        currentMonthKey: "",
        previousMonthKey: "",
      };
    }

    return buildDashboardMetrics(filteredRows, filteredOrders);
  }, [baseData, filteredRows, filteredOrders]);

  return (
    <div className="min-h-screen bg-[var(--pg-light)]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        <main className="p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <header className="pg-hero pg-pattern rounded-[32px] px-8 py-8 shadow-xl shadow-[rgba(0,72,59,0.12)]">
              <div className="pg-badge">somos movimiento</div>
              <h1 className="pg-display mt-4 text-5xl leading-none lg:text-6xl">
                Dashboard ejecutivo
              </h1>
              <p className="mt-3 max-w-3xl text-base text-white/78">
                Filtros por estado, fecha, ciudad, provincia, courrier y medio de pago.
              </p>
            </header>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div>
                <UploadVTEX onFileChange={handleFileChange} />
              </div>

              <div className="pg-card rounded-3xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="pg-display text-2xl text-[var(--pg-deep)]">
                      Gestión de reportes
                    </h3>
                    <p className="mt-1 text-sm text-[var(--pg-charcoal)]/65">
                      Subir un CSV nuevo reemplaza el reporte activo y conserva el historial.
                    </p>
                  </div>

                  <span className="rounded-full bg-[var(--pg-light)] px-3 py-1 text-xs font-semibold text-[var(--pg-deep)]">
                    {isUploading ? "Actualizando..." : "Operativo"}
                  </span>
                </div>

                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl bg-[var(--pg-light)] p-4">
                    <p className="text-sm text-[var(--pg-deep)]/70">Reporte activo</p>
                    <p className="mt-1 font-semibold text-[var(--pg-deep)]">
                      {activeReport?.report_name || "Sin reporte cargado"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[var(--pg-light)] p-4">
                    <p className="text-sm text-[var(--pg-deep)]/70">Última actualización</p>
                    <p className="mt-1 font-semibold text-[var(--pg-deep)]">
                      {activeReport?.uploaded_at
                        ? formatDateTime(activeReport.uploaded_at)
                        : "Sin fecha"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[var(--pg-light)] p-4">
                    <p className="text-sm text-[var(--pg-deep)]/70">Historial disponible</p>
                    <p className="mt-1 font-semibold text-[var(--pg-deep)]">
                      {reportHistory.length} reportes
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6">
              <FiltersBar
                filters={filters}
                setFilters={setFilters}
                options={filterOptions}
              />
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title="Facturación"
                value={formatCurrency(metrics.totalRevenue)}
                helper="Pedidos filtrados"
              />
              <KpiCard
                title="Órdenes"
                value={metrics.totalOrders}
                helper="Cantidad de pedidos"
              />
              <KpiCard
                title="Ticket promedio"
                value={formatCurrency(metrics.avgTicket)}
                helper="Ingreso promedio por orden"
              />
              <KpiCard
                title="Categoría más vendida"
                value={metrics.bestCategory?.name || "Sin categoría"}
                helper={
                  metrics.bestCategory
                    ? `${metrics.bestCategory.units} unidades`
                    : "Cargar CSV con categoría"
                }
              />
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <SalesChart data={metrics.salesDaily} />

              <div className="pg-card pg-pattern-soft rounded-3xl p-5">
                <h3 className="pg-display text-2xl text-[var(--pg-deep)]">Resumen rápido</h3>
                <p className="mt-1 text-sm text-[var(--pg-charcoal)]/58">
                  Lectura ejecutiva de los filtros aplicados.
                </p>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-[var(--pg-light)] p-4">
                    <p className="text-sm text-[var(--pg-deep)]/70">Producto líder</p>
                    <p className="pg-display mt-1 text-xl text-[var(--pg-deep)]">
                      {metrics.topProducts?.[0]?.name || "Sin datos"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[var(--pg-light)] p-4">
                    <p className="text-sm text-[var(--pg-deep)]/70">Top clientes</p>
                    <p className="pg-display mt-1 text-xl text-[var(--pg-deep)]">
                      {metrics.topClients?.length || 0}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[var(--pg-light)] p-4">
                    <p className="text-sm text-[var(--pg-deep)]/70">Categoría líder</p>
                    <p className="pg-display mt-1 text-xl text-[var(--pg-deep)]">
                      {metrics.bestCategory?.name || "Sin categoría"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[var(--pg-light)] p-4">
                    <p className="text-sm text-[var(--pg-deep)]/70">Período top actual</p>
                    <p className="pg-display mt-1 text-xl text-[var(--pg-deep)]">
                      {formatMonthKey(metrics.currentMonthKey)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[var(--pg-light)] p-4">
                    <p className="text-sm text-[var(--pg-deep)]/70">Período top anterior</p>
                    <p className="pg-display mt-1 text-xl text-[var(--pg-deep)]">
                      {formatMonthKey(metrics.previousMonthKey)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6">
              <div className="pg-card rounded-3xl p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="pg-display text-2xl text-[var(--pg-deep)]">
                      Historial de reportes
                    </h3>
                    <p className="mt-1 text-sm text-[var(--pg-charcoal)]/65">
                      Cada carga nueva reemplaza el activo, pero el histórico queda disponible.
                    </p>
                  </div>

                  <span className="rounded-full bg-[var(--pg-light)] px-3 py-1 text-xs font-semibold text-[var(--pg-deep)]">
                    {isSwitchingReport ? "Cambiando..." : `${reportHistory.length} guardados`}
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {reportHistory.length === 0 ? (
                    <div className="rounded-2xl bg-[var(--pg-light)] p-4 text-sm text-[var(--pg-charcoal)]/70">
                      Todavía no hay historial de reportes.
                    </div>
                  ) : (
                    reportHistory.map((report) => (
                      <div
                        key={report.id}
                        className="flex flex-col gap-3 rounded-2xl bg-[var(--pg-light)] p-4 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[var(--pg-deep)]">
                              {report.report_name}
                            </p>
                            {report.is_active ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                Activo
                              </span>
                            ) : (
                              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[var(--pg-charcoal)]/70">
                                Histórico
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-sm text-[var(--pg-charcoal)]/65">
                            Subido: {formatDateTime(report.uploaded_at)}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={report.is_active || isSwitchingReport}
                          onClick={() => handleActivateReport(report.id)}
                          className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                            report.is_active || isSwitchingReport
                              ? "cursor-not-allowed bg-white text-[var(--pg-charcoal)]/45"
                              : "bg-[var(--pg-deep)] text-white hover:opacity-90"
                          }`}
                        >
                          {report.is_active ? "En uso" : "Activar reporte"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="mt-6">
              <ProductsTable
                products={metrics.topProducts || []}
                title="Top 10 productos más vendidos"
              />
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-2">
              <ProductsTable
                products={metrics.topProductsCurrentMonth || []}
                title={`Top 10 del mes actual (${formatMonthKey(metrics.currentMonthKey)})`}
              />
              <ProductsTable
                products={metrics.topProductsPreviousMonth || []}
                title={`Top 10 del mes anterior (${formatMonthKey(metrics.previousMonthKey)})`}
              />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}