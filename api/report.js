import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("dashboard_reports")
      .select("id, report_name, uploaded_by, report_data, uploaded_at, is_active")
      .eq("is_active", true)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error obteniendo reporte activo:", error);
      return json({ error: "No se pudo obtener el reporte activo." }, 500);
    }

    if (!data) {
      return json({ report: null });
    }

    return json({ report: data });
  } catch (error) {
    console.error("Error inesperado en GET /api/report:", error);
    return json({ error: "Error interno del servidor." }, 500);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { reportName, uploadedBy, reportData } = body ?? {};

    if (!reportData) {
      return json({ error: "Falta reportData." }, 400);
    }

    const { error: deactivateError } = await supabase
      .from("dashboard_reports")
      .update({ is_active: false })
      .eq("is_active", true);

    if (deactivateError) {
      console.error("Error desactivando reporte anterior:", deactivateError);
      return json({ error: "No se pudo desactivar el reporte anterior." }, 500);
    }

    const { data, error: insertError } = await supabase
      .from("dashboard_reports")
      .insert([
        {
          report_name: reportName || "Reporte VTEX",
          uploaded_by: uploadedBy || "manual",
          report_data: reportData,
          is_active: true,
        },
      ])
      .select("id, report_name, uploaded_by, report_data, uploaded_at, is_active")
      .single();

    if (insertError) {
      console.error("Error guardando nuevo reporte:", insertError);
      return json({ error: "No se pudo guardar el nuevo reporte." }, 500);
    }

    return json({ ok: true, report: data }, 201);
  } catch (error) {
    console.error("Error inesperado en POST /api/report:", error);
    return json({ error: "Error interno del servidor." }, 500);
  }
}