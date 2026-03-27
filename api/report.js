import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseBody(req) {
  if (!req.body) return null;

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }

  return req.body;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const { history } = req.query;

      if (history === "1") {
        const { data, error } = await supabase
          .from("dashboard_reports")
          .select("id, report_name, uploaded_by, uploaded_at, is_active")
          .order("uploaded_at", { ascending: false })
          .limit(30);

        if (error) {
          console.error("Error obteniendo historial:", error);
          return res.status(500).json({ error: "No se pudo obtener el historial." });
        }

        return res.status(200).json({ reports: data || [] });
      }

      const { data, error } = await supabase
        .from("dashboard_reports")
        .select("id, report_name, uploaded_by, report_data, uploaded_at, is_active")
        .eq("is_active", true)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error obteniendo reporte activo:", error);
        return res.status(500).json({ error: "No se pudo obtener el reporte activo." });
      }

      return res.status(200).json({ report: data || null });
    } catch (error) {
      console.error("Error inesperado en GET /api/report:", error);
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  }

  if (req.method === "POST") {
    try {
      const body = parseBody(req);
      const { reportName, uploadedBy, reportData } = body || {};

      if (!reportData) {
        return res.status(400).json({ error: "Falta reportData." });
      }

      const { error: deactivateError } = await supabase
        .from("dashboard_reports")
        .update({ is_active: false })
        .eq("is_active", true);

      if (deactivateError) {
        console.error("Error desactivando reporte anterior:", deactivateError);
        return res.status(500).json({ error: "No se pudo desactivar el reporte anterior." });
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
        return res.status(500).json({ error: "No se pudo guardar el nuevo reporte." });
      }

      return res.status(201).json({ ok: true, report: data });
    } catch (error) {
      console.error("Error inesperado en POST /api/report:", error);
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  }

  if (req.method === "PATCH") {
    try {
      const body = parseBody(req);
      const { reportId } = body || {};

      if (!reportId) {
        return res.status(400).json({ error: "Falta reportId." });
      }

      const { error: deactivateError } = await supabase
        .from("dashboard_reports")
        .update({ is_active: false })
        .eq("is_active", true);

      if (deactivateError) {
        console.error("Error desactivando reporte actual:", deactivateError);
        return res.status(500).json({ error: "No se pudo desactivar el reporte actual." });
      }

      const { data, error: activateError } = await supabase
        .from("dashboard_reports")
        .update({ is_active: true })
        .eq("id", reportId)
        .select("id, report_name, uploaded_by, report_data, uploaded_at, is_active")
        .single();

      if (activateError) {
        console.error("Error reactivando reporte:", activateError);
        return res.status(500).json({ error: "No se pudo reactivar el reporte." });
      }

      return res.status(200).json({ ok: true, report: data });
    } catch (error) {
      console.error("Error inesperado en PATCH /api/report:", error);
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "PATCH"]);
  return res.status(405).json({ error: "Method not allowed" });
}