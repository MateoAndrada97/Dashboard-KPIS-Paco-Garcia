import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import KpiCard from "../components/dashboard/KpiCard";
import SalesChart from "../components/dashboard/SalesChart";
import ProductsTable from "../components/dashboard/ProductsTable";
import UploadVTEX from "../components/dashboard/UploadVTEX";
import FiltersBar from "../components/dashboard/FiltersBar";
import { mockData } from "../data/mockData";
import { supabaseBrowser } from "../lib/supabaseBrowser";
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
  }).format(value || 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(value || 0);
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

function getMonthKey(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function buildSeriesByMonth(uniqueOrders) {
  const monthMap = new Map();

  uniqueOrders.forEach((order) => {
    const monthKey = getMonthKey(order.creationDate);
    if (!monthKey) return;

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        rawDate: monthKey,
        date: formatMonthKey(monthKey),
        revenue: 0,
        orders: 0,
      });
    }

    const current = monthMap.get(monthKey);
    current.revenue += order.totalValue || 0;
    current.orders += 1;
  });

  return Array.from(monthMap.values())
    .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
    .map((item) => ({
      date: item.date,
      revenue: item.revenue,
      orders: item.orders,
      avgTicket: item.orders ? item.revenue / item.orders : 0,
    }));
}

function buildRanking(items, keyGetter, valueGetter) {
  const map = new Map();

  items.forEach((item) => {
    const key = keyGetter(item) || "Sin dato";

    if (!map.has(key)) {
      map.set(key, {
        name: key,
        orders: 0,
        revenue: 0,
      });
    }

    const current = map.get(key);
    current.orders += 1;
    current.revenue += valueGetter(item) || 0;
  });

  return Array.from(map.values()).sort((a, b) => {
    if (b.revenue !== a.revenue) return b.revenue - a.revenue;
    return b.orders - a.orders;
  });
}

function buildProductsCatalog(rows) {
  const productMap = new Map();

  rows.forEach((row) => {
    const key = `${row.skuId}-${row.skuName}`;

    if (!productMap.has(key)) {
      productMap.set(key, {
        key,
        id: row.skuId || key,
        name: row.skuName || "Sin nombre",
        category: row.category || "Sin categoría",
        units: 0,
        revenue: 0,
        ordersSet: new Set(),
        firstSale: row.creationDate || "",
        lastSale: row.creationDate || "",
      });
    }

    const current = productMap.get(key);
    current.units += row.quantity || 0;
    current.revenue += row.skuTotalPrice || 0;

    if (row.order) current.ordersSet.add(row.order);
    if (row.creationDate && (!current.firstSale || row.creationDate < current.firstSale)) {
      current.firstSale = row.creationDate;
    }
    if (row.creationDate && (!current.lastSale || row.creationDate > current.lastSale)) {
      current.lastSale = row.creationDate;
    }
  });

  return Array.from(productMap.values())
    .map((item) => ({
      key: item.key,
      id: item.id,
      name: item.name,
      category: item.category,
      units: item.units,
      revenue: item.revenue,
      orders: item.ordersSet.size,
      avgUnitRevenue: item.units ? item.revenue / item.units : 0,
      firstSale: item.firstSale,
      lastSale: item.lastSale,
    }))
    .sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return b.units - a.units;
    });
}

function buildProductTrend(rows) {
  const trendMap = new Map();

  rows.forEach((row) => {
    const monthKey = getMonthKey(row.creationDate);
    if (!monthKey) return;

    if (!trendMap.has(monthKey)) {
      trendMap.set(monthKey, {
        rawDate: monthKey,
        date: formatMonthKey(monthKey),
        revenue: 0,
        ordersSet: new Set(),
        units: 0,
      });
    }

    const current = trendMap.get(monthKey);
    current.revenue += row.skuTotalPrice || 0;
    current.units += row.quantity || 0;
    if (row.order) current.ordersSet.add(row.order);
  });

  return Array.from(trendMap.values())
    .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
    .map((item) => ({
      date: item.date,
      revenue: item.revenue,
      orders: item.ordersSet.size,
      avgTicket: item.ordersSet.size ? item.revenue / item.ordersSet.size : 0,
      units: item.units,
    }));
}

function buildOrdersTable(uniqueOrders) {
  return [...uniqueOrders]
    .sort((a, b) => (b.creationDate || "").localeCompare(a.creationDate || ""))
    .slice(0, 12);
}

function buildImprovementCards({
  activeReport,
  reportHistory,
  metrics,
  provinceRanking,
  courierRanking,
  productsCatalog,
}) {
  const cards = [];

  cards.push({
    title: "Gobierno de dato",
    text:
      metrics.bestCategory?.name === "Sin categoría"
        ? "El próximo quick win es mapear categorías en origen o enriquecer el adapter para dejar de perder lectura comercial por familia."
        : `La categoría líder hoy es ${metrics.bestCategory?.name}.`,
  });

  if (productsCatalog[0]) {
    cards.push({
      title: "Producto ancla",
      text: `${productsCatalog[0].name} lidera el mix filtrado con ${formatNumber(
        productsCatalog[0].units
      )} unidades y ${formatCurrency(productsCatalog[0].revenue)} de facturación.`,
    });
  }

  if (provinceRanking[0]) {
    cards.push({
      title: "Concentración geográfica",
      text: `${provinceRanking[0].name} es la provincia con mayor facturación en el set filtrado. Conviene revisar surtido, tiempos y pauta geolocalizada.`,
    });
  }

  if (courierRanking[0]) {
    cards.push({
      title: "Logística",
      text: `${courierRanking[0].name} es el courier más usado. Tiene sentido medir SLA, costo y reclamos sobre ese carrier.`,
    });
  }

  cards.push({
    title: "Versionado de reportes",
    text: activeReport
      ? `El reporte activo es ${activeReport.report_name} y ya tenés ${reportHistory.length} snapshots guardados para auditoría.`
      : "Todavía no hay reporte activo cargado.",
  });

  return cards.slice(0, 4);
}

const SECTION_META = {
  Resumen: {
    title: "Dashboard Paco García",
    description: "Vista ejecutiva con KPIs generales, reporte activo e histórico.",
  },
  Ventas: {
    title: "Ventas",
    description: "Análisis más profundo de pedidos, facturación, ticket y evolución temporal.",
  },
  Productos: {
    title: "Productos",
    description: "Historial de ventas por SKU o producto dentro del período filtrado.",
  },
  Sucursales: {
    title: "Sucursales",
    description: "Lectura territorial y operativa por ciudad, provincia y courier.",
  },
  "Costos y margen": {
    title: "Costos y margen",
    description: "Espacio preparado para cruzar ventas con costos por SKU.",
  },
  "Plan de mejoras": {
    title: "Plan de mejoras",
    description: "Backlog ejecutivo de oportunidades detectadas a partir del reporte.",
  },
};

function normalizeReport(raw) {
  if (!raw) return null;

  return {
    ...raw,
    report_name: raw.report_name || raw.file_name || raw.fileName || "Reporte sin nombre",
    uploaded_at: raw.uploaded_at || raw.created_at || raw.updated_at || null,
    is_active: Boolean(raw.is_active),
    downloadUrl: raw.downloadUrl || raw.download_url || null,
  };
}

function extractReport(payload) {
  if (!payload) return null;
  if (payload.report) return normalizeReport(payload.report);
  return normalizeReport(payload);
}

function extractReports(payload) {
  if (!payload) return [];
  const reports = Array.isArray(payload) ? payload : payload.reports || [];
  return reports.map(normalizeReport);
}

async function adaptReportFromDownloadUrl(downloadUrl, fileName = "reporte.csv") {
  if (!downloadUrl) return null;

  const response = await fetch(downloadUrl, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("No se pudo descargar el CSV activo desde Storage.");
  }

  const blob = await response.blob();
  const file = new File([blob], fileName, {
    type: blob.type || "text/csv",
  });

  const rows = await parseVTEXFile(file);
  return adaptVTEXRows(rows);
}

function RankingTable({ title, rows, valueLabel = "Facturación" }) {
  return (
    <div className="pg-card rounded-3xl p-5">
      <h3 className="pg-display text-2xl text-[var(--pg-deep)]">{title}</h3>
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-black/8 text-left text-[var(--pg-charcoal)]/65">
              <th className="px-2 py-2 font-medium">Nombre</th>
              <th className="px-2 py-2 font-medium">Órdenes</th>
              <th className="px-2 py-2 font-medium">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-2 py-4 text-[var(--pg-charcoal)]/55">
                  Sin datos para mostrar.
                </td>
              </tr>
            ) : (
              rows.slice(0, 10).map((row) => (
                <tr key={row.name} className="border-b border-black/5">
                  <td className="px-2 py-3 font-medium text-[var(--pg-deep)]">{row.name}</td>
                  <td className="px-2 py-3 text-[var(--pg-charcoal)]/75">
                    {formatNumber(row.orders)}
                  </td>
                  <td className="px-2 py-3 text-[var(--pg-charcoal)]/75">
                    {formatCurrency(row.revenue)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState("Resumen");
  const [baseData, setBaseData] = useState(null);
  const [activeReport, setActiveReport] = useState(null);
  const [reportHistory, setReportHistory] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSwitchingReport, setIsSwitchingReport] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [selectedProductKey, setSelectedProductKey] = useState("");

  const [filters, setFilters] = useState({
    status: "all",
    dateFrom: "",
    dateTo: "",
    city: "all",
    state: "all",
    courrier: "all",
    paymentMethod: "all",
  });

  const loadReportHistory = async () => {
    const response = await fetch("/api/report?history=1", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("No se pudo obtener el historial.");
    }

    const payload = await response.json();
    setReportHistory(extractReports(payload));
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const [activeResponse, historyResponse] = await Promise.all([
          fetch("/api/report", { method: "GET", cache: "no-store" }),
          fetch("/api/report?history=1", { method: "GET", cache: "no-store" }),
        ]);

        if (!activeResponse.ok) throw new Error("No se pudo obtener el reporte activo.");
        if (!historyResponse.ok) throw new Error("No se pudo obtener el historial.");

        const activePayload = await activeResponse.json();
        const historyPayload = await historyResponse.json();

        if (cancelled) return;

        const normalizedActiveReport = extractReport(activePayload);
        const normalizedHistory = extractReports(historyPayload);

        setReportHistory(normalizedHistory);
        setActiveReport(normalizedActiveReport);

        if (!normalizedActiveReport) {
          setBaseData(null);
          return;
        }

        if (normalizedActiveReport.report_data) {
          setBaseData(normalizedActiveReport.report_data);
          return;
        }

        if (normalizedActiveReport.downloadUrl) {
          const adapted = await adaptReportFromDownloadUrl(
            normalizedActiveReport.downloadUrl,
            normalizedActiveReport.report_name
          );

          if (!cancelled) {
            setBaseData(adapted);
          }

          return;
        }

        setBaseData(null);
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

      const safeName = file.name.replace(/\s+/g, "-");
      const storagePath = `reports/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabaseBrowser.storage
        .from("dashboard-reports")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "text/csv",
        });

      if (uploadError) {
        throw new Error(`Storage upload error: ${uploadError.message}`);
      }

      const rows = await parseVTEXFile(file);
      const adapted = adaptVTEXRows(rows);

      const response = await fetch("/api/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "register-upload",
          fileName: file.name,
          reportName: file.name,
          uploadedBy: "manual",
          storagePath,
          fileSize: file.size,
          mimeType: file.type || "text/csv",
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo registrar el reporte.");
      }

      const normalizedReport = extractReport(payload);

      setBaseData(adapted);
      setActiveReport(normalizedReport);
      await loadReportHistory();
      setActiveSection("Resumen");
    } catch (error) {
      console.error("ERROR FINAL handleFileChange:", error);
      alert(error.message || "No se pudo procesar o guardar el archivo CSV.");
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

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo reactivar el reporte.");
      }

      const normalizedReport = extractReport(payload);

      setActiveReport(normalizedReport);

      if (!normalizedReport) {
        setBaseData(null);
      } else if (normalizedReport.report_data) {
        setBaseData(normalizedReport.report_data);
      } else if (normalizedReport.downloadUrl) {
        const adapted = await adaptReportFromDownloadUrl(
          normalizedReport.downloadUrl,
          normalizedReport.report_name
        );
        setBaseData(adapted);
      } else {
        setBaseData(null);
      }

      await loadReportHistory();
    } catch (error) {
      console.error("Error reactivando reporte:", error);
      alert(error.message || "No se pudo reactivar el reporte seleccionado.");
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

  const totalUnits = useMemo(
    () => filteredRows.reduce((acc, row) => acc + (row.quantity || 0), 0),
    [filteredRows]
  );

  const totalShipping = useMemo(
    () => filteredOrders.reduce((acc, order) => acc + (order.shippingValue || 0), 0),
    [filteredOrders]
  );

  const salesByMonth = useMemo(() => buildSeriesByMonth(filteredOrders), [filteredOrders]);
  const statusRanking = useMemo(
    () => buildRanking(filteredOrders, (item) => item.status, (item) => item.totalValue),
    [filteredOrders]
  );
  const provinceRanking = useMemo(
    () => buildRanking(filteredOrders, (item) => item.state, (item) => item.totalValue),
    [filteredOrders]
  );
  const courierRanking = useMemo(
    () => buildRanking(filteredOrders, (item) => item.courrier, (item) => item.totalValue),
    [filteredOrders]
  );
  const cityRanking = useMemo(
    () => buildRanking(filteredOrders, (item) => item.city, (item) => item.totalValue),
    [filteredOrders]
  );
  const ordersTable = useMemo(() => buildOrdersTable(filteredOrders), [filteredOrders]);

  const productsCatalog = useMemo(() => buildProductsCatalog(filteredRows), [filteredRows]);

  const matchedProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();

    if (!query) return productsCatalog.slice(0, 12);

    return productsCatalog
      .filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          String(item.id || "").toLowerCase().includes(query)
      )
      .slice(0, 12);
  }, [productsCatalog, productQuery]);

  useEffect(() => {
    if (!productsCatalog.length) {
      setSelectedProductKey("");
      return;
    }

    const exists = productsCatalog.some((item) => item.key === selectedProductKey);

    if (!exists) {
      setSelectedProductKey(productsCatalog[0].key);
    }
  }, [productsCatalog, selectedProductKey]);

  const selectedProduct =
    productsCatalog.find((item) => item.key === selectedProductKey) || null;

  const selectedProductRows = useMemo(() => {
    if (!selectedProduct) return [];
    return filteredRows.filter(
      (row) => `${row.skuId}-${row.skuName}` === selectedProduct.key
    );
  }, [filteredRows, selectedProduct]);

  const selectedProductTrend = useMemo(
    () => buildProductTrend(selectedProductRows),
    [selectedProductRows]
  );

  const selectedProductTopPeriods = useMemo(
    () =>
      [...selectedProductTrend]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6),
    [selectedProductTrend]
  );

  const improvementCards = useMemo(
    () =>
      buildImprovementCards({
        activeReport,
        reportHistory,
        metrics,
        provinceRanking,
        courierRanking,
        productsCatalog,
      }),
    [activeReport, reportHistory, metrics, provinceRanking, courierRanking, productsCatalog]
  );

  const currentMeta = SECTION_META[activeSection];

  const renderFilters = () => (
    <section className="mt-6">
      <FiltersBar filters={filters} setFilters={setFilters} options={filterOptions} />
    </section>
  );

  const renderReportManagement = () => (
    <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div>
        <UploadVTEX onFileChange={handleFileChange} />
      </div>

      <div className="pg-card rounded-3xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="pg-display text-2xl text-[var(--pg-deep)]">Gestión de reportes</h3>
            <p className="mt-1 text-sm text-[var(--pg-charcoal)]/65">
              Subir un CSV nuevo reemplaza el reporte activo y deja trazabilidad en el historial.
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
              {activeReport?.uploaded_at ? formatDateTime(activeReport.uploaded_at) : "Sin fecha"}
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
  );

  const renderHistory = () => (
    <section className="mt-6">
      <div className="pg-card rounded-3xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="pg-display text-2xl text-[var(--pg-deep)]">Historial de reportes</h3>
            <p className="mt-1 text-sm text-[var(--pg-charcoal)]/65">
              Podés reactivar snapshots anteriores sin perder el reporte actual.
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
                    <p className="font-semibold text-[var(--pg-deep)]">{report.report_name}</p>
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
  );

  const renderSummary = () => (
    <>
      {renderReportManagement()}
      {renderFilters()}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Facturación" value={formatCurrency(metrics.totalRevenue)} helper="Pedidos filtrados" />
        <KpiCard title="Órdenes" value={formatNumber(metrics.totalOrders)} helper="Cantidad de pedidos" />
        <KpiCard title="Ticket promedio" value={formatCurrency(metrics.avgTicket)} helper="Ingreso promedio por orden" />
        <KpiCard
          title="Categoría más vendida"
          value={metrics.bestCategory?.name || "Sin categoría"}
          helper={
            metrics.bestCategory
              ? `${formatNumber(metrics.bestCategory.units)} unidades`
              : "Cargar CSV con categoría"
          }
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <SalesChart data={metrics.salesDaily} />

        <div className="pg-card pg-pattern-soft rounded-3xl p-5">
          <h3 className="pg-display text-2xl text-[var(--pg-deep)]">Resumen rápido</h3>
          <p className="mt-1 text-sm text-[var(--pg-charcoal)]/58">
            Lectura ejecutiva del reporte filtrado.
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
                {formatNumber(metrics.topClients?.length || 0)}
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
        <ProductsTable products={metrics.topProducts || []} title="Top 10 productos más vendidos" />
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

      {renderHistory()}
    </>
  );

  const renderSales = () => (
    <>
      {renderFilters()}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Facturación" value={formatCurrency(metrics.totalRevenue)} helper="Total filtrado" />
        <KpiCard title="Órdenes" value={formatNumber(metrics.totalOrders)} helper="Pedidos únicos" />
        <KpiCard title="Unidades" value={formatNumber(totalUnits)} helper="SKU vendidos" />
        <KpiCard title="Shipping" value={formatCurrency(totalShipping)} helper="Costo logístico informado" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <SalesChart data={salesByMonth.length ? salesByMonth : metrics.salesDaily} />

        <div className="pg-card rounded-3xl p-5">
          <h3 className="pg-display text-2xl text-[var(--pg-deep)]">Foco comercial</h3>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-[var(--pg-light)] p-4">
              <p className="text-sm text-[var(--pg-deep)]/70">Estado líder</p>
              <p className="pg-display mt-1 text-xl text-[var(--pg-deep)]">
                {statusRanking[0]?.name || "Sin datos"}
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--pg-light)] p-4">
              <p className="text-sm text-[var(--pg-deep)]/70">Provincia líder</p>
              <p className="pg-display mt-1 text-xl text-[var(--pg-deep)]">
                {provinceRanking[0]?.name || "Sin datos"}
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--pg-light)] p-4">
              <p className="text-sm text-[var(--pg-deep)]/70">Courier líder</p>
              <p className="pg-display mt-1 text-xl text-[var(--pg-deep)]">
                {courierRanking[0]?.name || "Sin datos"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <RankingTable title="Ventas por estado" rows={statusRanking} />
        <RankingTable title="Ventas por provincia" rows={provinceRanking} />
        <RankingTable title="Ventas por courier" rows={courierRanking} />
      </section>

      <section className="mt-6">
        <div className="pg-card rounded-3xl p-5">
          <h3 className="pg-display text-2xl text-[var(--pg-deep)]">Últimas órdenes filtradas</h3>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-black/8 text-left text-[var(--pg-charcoal)]/65">
                  <th className="px-2 py-2 font-medium">Orden</th>
                  <th className="px-2 py-2 font-medium">Fecha</th>
                  <th className="px-2 py-2 font-medium">Ciudad</th>
                  <th className="px-2 py-2 font-medium">Provincia</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  <th className="px-2 py-2 font-medium">Pago</th>
                  <th className="px-2 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {ordersTable.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-4 text-[var(--pg-charcoal)]/55">
                      Sin órdenes para mostrar.
                    </td>
                  </tr>
                ) : (
                  ordersTable.map((order) => (
                    <tr key={order.order} className="border-b border-black/5">
                      <td className="px-2 py-3 font-medium text-[var(--pg-deep)]">{order.order}</td>
                      <td className="px-2 py-3 text-[var(--pg-charcoal)]/75">
                        {order.creationDate?.slice(0, 10) || "-"}
                      </td>
                      <td className="px-2 py-3 text-[var(--pg-charcoal)]/75">{order.city}</td>
                      <td className="px-2 py-3 text-[var(--pg-charcoal)]/75">{order.state}</td>
                      <td className="px-2 py-3 text-[var(--pg-charcoal)]/75">{order.status}</td>
                      <td className="px-2 py-3 text-[var(--pg-charcoal)]/75">
                        {order.paymentMethod}
                      </td>
                      <td className="px-2 py-3 text-[var(--pg-charcoal)]/75">
                        {formatCurrency(order.totalValue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );

  const renderProducts = () => (
    <>
      {renderFilters()}

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="pg-card rounded-3xl p-5">
          <h3 className="pg-display text-2xl text-[var(--pg-deep)]">Buscador de producto</h3>
          <p className="mt-1 text-sm text-[var(--pg-charcoal)]/65">
            Buscá por nombre o SKU ID para ver historial de ventas dentro del período filtrado.
          </p>

          <input
            type="text"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Ej: Duramo, Supernova, 2.121..."
            className="mt-5 w-full rounded-2xl border border-black/10 bg-[var(--pg-light)] px-4 py-3 text-sm outline-none"
          />

          <div className="mt-4 space-y-2">
            {matchedProducts.length === 0 ? (
              <div className="rounded-2xl bg-[var(--pg-light)] p-4 text-sm text-[var(--pg-charcoal)]/70">
                No hay coincidencias para esa búsqueda.
              </div>
            ) : (
              matchedProducts.map((product) => (
                <button
                  key={product.key}
                  type="button"
                  onClick={() => setSelectedProductKey(product.key)}
                  className={`w-full rounded-2xl p-4 text-left transition ${
                    selectedProductKey === product.key
                      ? "bg-[var(--pg-deep)] text-white"
                      : "bg-[var(--pg-light)] text-[var(--pg-deep)] hover:bg-white"
                  }`}
                >
                  <p className="font-semibold">{product.name}</p>
                  <p className={`mt-1 text-xs ${selectedProductKey === product.key ? "text-white/75" : "text-[var(--pg-charcoal)]/65"}`}>
                    SKU: {product.id} · {formatNumber(product.units)} unidades · {formatCurrency(product.revenue)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="pg-card rounded-3xl p-5">
          <h3 className="pg-display text-2xl text-[var(--pg-deep)]">Ficha del producto</h3>

          {!selectedProduct ? (
            <div className="mt-5 rounded-2xl bg-[var(--pg-light)] p-4 text-sm text-[var(--pg-charcoal)]/70">
              Seleccioná un producto para ver su historial.
            </div>
          ) : (
            <>
              <div className="mt-4 rounded-2xl bg-[var(--pg-light)] p-4">
                <p className="font-semibold text-[var(--pg-deep)]">{selectedProduct.name}</p>
                <p className="mt-1 text-sm text-[var(--pg-charcoal)]/65">
                  SKU: {selectedProduct.id} · Categoría: {selectedProduct.category}
                </p>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard title="Unidades" value={formatNumber(selectedProduct.units)} helper="SKU vendidos" />
                <KpiCard title="Facturación" value={formatCurrency(selectedProduct.revenue)} helper="Ingresos del producto" />
                <KpiCard title="Órdenes" value={formatNumber(selectedProduct.orders)} helper="Pedidos con el producto" />
                <KpiCard
                  title="Precio unitario"
                  value={formatCurrency(selectedProduct.avgUnitRevenue)}
                  helper="Promedio por unidad"
                />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-[var(--pg-light)] p-4">
                  <p className="text-sm text-[var(--pg-deep)]/70">Primera venta filtrada</p>
                  <p className="mt-1 font-semibold text-[var(--pg-deep)]">
                    {selectedProduct.firstSale?.slice(0, 10) || "Sin fecha"}
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--pg-light)] p-4">
                  <p className="text-sm text-[var(--pg-deep)]/70">Última venta filtrada</p>
                  <p className="mt-1 font-semibold text-[var(--pg-deep)]">
                    {selectedProduct.lastSale?.slice(0, 10) || "Sin fecha"}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <SalesChart data={selectedProductTrend} />
        <div className="pg-card rounded-3xl p-5">
          <h3 className="pg-display text-2xl text-[var(--pg-deep)]">Top períodos del producto</h3>
          <div className="mt-5 space-y-3">
            {selectedProductTopPeriods.length === 0 ? (
              <div className="rounded-2xl bg-[var(--pg-light)] p-4 text-sm text-[var(--pg-charcoal)]/70">
                Sin histórico suficiente.
              </div>
            ) : (
              selectedProductTopPeriods.map((period) => (
                <div key={period.date} className="rounded-2xl bg-[var(--pg-light)] p-4">
                  <p className="font-semibold text-[var(--pg-deep)]">{period.date}</p>
                  <p className="mt-1 text-sm text-[var(--pg-charcoal)]/70">
                    {formatCurrency(period.revenue)} · {formatNumber(period.orders)} órdenes · {formatNumber(period.units)} unidades
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <ProductsTable products={productsCatalog.slice(0, 10)} title="Top 10 productos del período filtrado" />
      </section>
    </>
  );

  const renderBranches = () => (
    <>
      {renderFilters()}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Provincias" value={formatNumber(provinceRanking.length)} helper="Cobertura geográfica" />
        <KpiCard title="Ciudades" value={formatNumber(cityRanking.length)} helper="Plazas con ventas" />
        <KpiCard title="Couriers" value={formatNumber(courierRanking.length)} helper="Operadores logísticos" />
        <KpiCard title="Órdenes" value={formatNumber(metrics.totalOrders)} helper="Pedidos del período" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <RankingTable title="Top provincias" rows={provinceRanking} />
        <RankingTable title="Top ciudades" rows={cityRanking} />
        <RankingTable title="Top couriers" rows={courierRanking} />
      </section>
    </>
  );

  const renderCosts = () => (
    <section className="mt-6 grid gap-6 xl:grid-cols-3">
      <div className="pg-card rounded-3xl p-5">
        <h3 className="pg-display text-2xl text-[var(--pg-deep)]">Próximo input</h3>
        <p className="mt-3 text-sm text-[var(--pg-charcoal)]/65">
          Acá vamos a cargar el archivo de costos para cruzarlo con ventas.
        </p>
      </div>

      <div className="pg-card rounded-3xl p-5">
        <h3 className="pg-display text-2xl text-[var(--pg-deep)]">Llave de cruce</h3>
        <p className="mt-3 text-sm text-[var(--pg-charcoal)]/65">
          El cruce recomendado es ID_SKU de ventas contra SKU ID del archivo de costos.
        </p>
      </div>

      <div className="pg-card rounded-3xl p-5">
        <h3 className="pg-display text-2xl text-[var(--pg-deep)]">Resultado esperado</h3>
        <p className="mt-3 text-sm text-[var(--pg-charcoal)]/65">
          KPI de costo vendido, margen bruto, margen %, ranking rentable y faltantes de costo.
        </p>
      </div>
    </section>
  );

  const renderPlan = () => (
    <section className="mt-6 grid gap-6 xl:grid-cols-2">
      {improvementCards.map((card) => (
        <div key={card.title} className="pg-card rounded-3xl p-5">
          <h3 className="pg-display text-2xl text-[var(--pg-deep)]">{card.title}</h3>
          <p className="mt-3 text-sm text-[var(--pg-charcoal)]/68">{card.text}</p>
        </div>
      ))}
    </section>
  );

  const renderSection = () => {
    switch (activeSection) {
      case "Ventas":
        return renderSales();
      case "Productos":
        return renderProducts();
      case "Sucursales":
        return renderBranches();
      case "Costos y margen":
        return renderCosts();
      case "Plan de mejoras":
        return renderPlan();
      case "Resumen":
      default:
        return renderSummary();
    }
  };

  return (
    <div className="min-h-screen bg-[var(--pg-light)]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <div className="hidden lg:block">
          <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        </div>

        <main className="p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <header className="pg-hero pg-pattern rounded-[32px] px-8 py-8 shadow-xl shadow-[rgba(0,72,59,0.12)]">
              <div className="pg-badge">somos movimiento</div>
              <h1 className="pg-display mt-4 text-5xl leading-none lg:text-6xl">
                {currentMeta.title}
              </h1>
              <p className="mt-3 max-w-3xl text-base text-white/78">
                {currentMeta.description}
              </p>
            </header>

            {renderSection()}
          </div>
        </main>
      </div>
    </div>
  );
}