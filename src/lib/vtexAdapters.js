import Papa from "papaparse";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;

  const raw = String(value).trim();

  if (raw.includes(".") && raw.includes(",")) {
    return Number(raw.replace(/\./g, "").replace(",", "."));
  }

  if (raw.includes(",")) {
    return Number(raw.replace(",", "."));
  }

  return Number(raw);
}

function getField(row, names, fallback = "") {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
      return row[name];
    }
  }
  return fallback;
}

function normalizeProvince(value) {
  const map = {
    B: "Buenos Aires",
    C: "CABA",
    K: "Catamarca",
    H: "Chaco",
    U: "Chubut",
    X: "Córdoba",
    W: "Corrientes",
    E: "Entre Ríos",
    P: "Formosa",
    Y: "Jujuy",
    L: "La Pampa",
    F: "La Rioja",
    M: "Mendoza",
    N: "Misiones",
    Q: "Neuquén",
    R: "Río Negro",
    A: "Salta",
    J: "San Juan",
    D: "San Luis",
    Z: "Santa Cruz",
    S: "Santa Fe",
    G: "Santiago del Estero",
    V: "Tierra del Fuego",
    T: "Tucumán",
  };

  return map[value] || value || "Sin provincia";
}

function formatShortDate(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function getMonthKey(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function buildTopProducts(rows) {
  const productMap = new Map();

  rows.forEach((row) => {
    const key = `${row.skuId}-${row.skuName}`;

    if (!productMap.has(key)) {
      productMap.set(key, {
        id: row.skuId || key,
        name: row.skuName,
        category: row.category || "Sin categoría",
        units: 0,
        revenue: 0,
      });
    }

    const product = productMap.get(key);
    product.units += row.quantity;
    product.revenue += row.skuTotalPrice;
  });

  return Array.from(productMap.values())
    .sort((a, b) => {
      if (b.units !== a.units) return b.units - a.units;
      return b.revenue - a.revenue;
    })
    .slice(0, 10);
}

export function parseVTEXFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      complete: (results) => resolve(results.data),
      error: reject,
    });
  });
}

export function adaptVTEXRows(rows) {
  const normalized = rows.map((row) => ({
    order: getField(row, ["Order"]),
    creationDate: getField(row, ["Creation Date"]),
    status: getField(row, ["Status"], "Sin estado"),
    city: getField(row, ["City", "Shipping City"], "Sin ciudad"),
    state: normalizeProvince(
      getField(row, ["UF", "State", "Province", "Shipping State"], "Sin provincia")
    ),
    courrier: getField(row, ["Courrier", "Courier", "Carrier"], "Sin courrier"),
    paymentMethod: getField(row, ["Payment System Name"], "Sin medio de pago"),
    email: getField(row, ["Email"]),
    clientName: `${getField(row, ["Client Name"])} ${getField(row, ["Client Last Name"])}`.trim(),
    skuId: getField(row, ["ID_SKU"]),
    skuName: getField(row, ["SKU Name"], "Sin nombre"),
    category: getField(row, ["Category", "Category Name"], "Sin categoría"),
    quantity: toNumber(getField(row, ["Quantity_SKU"], 0)),
    skuTotalPrice: toNumber(getField(row, ["SKU Total Price"], 0)),
    totalValue: toNumber(getField(row, ["Total Value"], 0)),
    shippingValue: toNumber(getField(row, ["Shipping Value"], 0)),
  }));

  const orderMap = new Map();

  normalized.forEach((row) => {
    if (!row.order) return;
    if (!orderMap.has(row.order)) {
      orderMap.set(row.order, row);
    }
  });

  const uniqueOrders = Array.from(orderMap.values());

  return {
    rows: normalized,
    uniqueOrders,
  };
}

export function buildDashboardMetrics(rows, uniqueOrders) {
  const totalRevenue = uniqueOrders.reduce((acc, order) => acc + order.totalValue, 0);
  const totalOrders = uniqueOrders.length;
  const avgTicket = totalOrders ? totalRevenue / totalOrders : 0;

  const salesMap = new Map();

  uniqueOrders.forEach((order) => {
    const rawDate = order.creationDate?.slice(0, 10);
    if (!rawDate) return;

    if (!salesMap.has(rawDate)) {
      salesMap.set(rawDate, {
        rawDate,
        date: formatShortDate(rawDate),
        revenue: 0,
        orders: 0,
      });
    }

    const current = salesMap.get(rawDate);
    current.revenue += order.totalValue;
    current.orders += 1;
  });

  const salesDaily = Array.from(salesMap.values())
    .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
    .map((item) => ({
      date: item.date,
      revenue: item.revenue,
      orders: item.orders,
      avgTicket: item.orders ? item.revenue / item.orders : 0,
    }));

  const topProducts = buildTopProducts(rows);

  const categoryMap = new Map();

  rows.forEach((row) => {
    const categoryName = row.category || "Sin categoría";

    if (!categoryMap.has(categoryName)) {
      categoryMap.set(categoryName, {
        name: categoryName,
        units: 0,
        revenue: 0,
      });
    }

    const category = categoryMap.get(categoryName);
    category.units += row.quantity;
    category.revenue += row.skuTotalPrice;
  });

  const categories = Array.from(categoryMap.values()).sort((a, b) => {
    if (b.units !== a.units) return b.units - a.units;
    return b.revenue - a.revenue;
  });

  const bestCategory = categories[0] || null;

  const clientMap = new Map();

  uniqueOrders.forEach((order) => {
    const key = order.email || order.clientName || order.order;

    if (!clientMap.has(key)) {
      clientMap.set(key, {
        name: order.clientName || order.email || "Cliente sin nombre",
        visits: 0,
        spend: 0,
        lastPurchase: order.creationDate?.slice(0, 10) || "",
      });
    }

    const client = clientMap.get(key);
    client.visits += 1;
    client.spend += order.totalValue;

    const currentDate = order.creationDate?.slice(0, 10) || "";
    if (currentDate > client.lastPurchase) {
      client.lastPurchase = currentDate;
    }
  });

  const topClients = Array.from(clientMap.values())
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);

  const monthKeys = [...new Set(uniqueOrders.map((o) => getMonthKey(o.creationDate)).filter(Boolean))].sort();
  const currentMonthKey = monthKeys[monthKeys.length - 1] || "";
  const previousMonthKey = monthKeys[monthKeys.length - 2] || "";

  const currentMonthRows = rows.filter((row) => getMonthKey(row.creationDate) === currentMonthKey);
  const previousMonthRows = rows.filter((row) => getMonthKey(row.creationDate) === previousMonthKey);

  const topProductsCurrentMonth = buildTopProducts(currentMonthRows);
  const topProductsPreviousMonth = buildTopProducts(previousMonthRows);

  return {
    totalRevenue,
    totalOrders,
    avgTicket,
    salesDaily,
    topProducts,
    bestCategory,
    topClients,
    topProductsCurrentMonth,
    topProductsPreviousMonth,
    currentMonthKey,
    previousMonthKey,
  };
}