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

async function getSignedDownloadUrl(storagePath) {
  if (!storagePath) return null;

  const { data, error } = await supabase.storage
    .from("dashboard-reports")
    .createSignedUrl(storagePath, 60 * 60);

  if (error) {
    console.error("Error creando signed URL:", error);
    return null;
  }

  return data?.signedUrl || null;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const { history } = req.query;

      if (history === "1") {
        const { data, error } = await supabase
          .from("dashboard_reports")
          .select("id, report_name, uploaded_by, uploaded_at, is_active, storage_path, file_size, mime_type")
          .order("uploaded_at", { ascending: false })
          .limit(50);

        if (error) {
          console.error("Error obteniendo historial:", error);
          return res.status(500).json({ error: "No se pudo obtener el historial." });
        }

        return res.status(200).json({ reports: data || [] });
      }

      const { data, error } = await supabase
        .from("dashboard_reports")
        .select("id, report_name, uploaded_by, uploaded_at, is_active, storage_path, file_size, mime_type, report_data")
        .eq("is_active", true)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error obteniendo reporte activo:", error);
        return res.status(500).json({ error: "No se pudo obtener el reporte activo." });
      }

      if (!data) {
        return res.status(200).json({ report: null });
      }

      const downloadUrl = data.storage_path
        ? await getSignedDownloadUrl(data.storage_path)
        : null;

      return res.status(200).json({
        report: {
          ...data,
          downloadUrl,
        },
      });
    } catch (error) {
      console.error("Error inesperado en GET /api/report:", error);
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  }

  if (req.method === "POST") {
    try {
      const body = parseBody(req);
      const { action } = body || {};

      if (action === "register-upload") {
        const { reportName, uploadedBy, storagePath, fileSize, mimeType } = body || {};

        if (!storagePath) {
          return res.status(400).json({ error: "Falta storagePath." });
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
              storage_path: storagePath,
              file_size: fileSize || null,
              mime_type: mimeType || "text/csv",
              is_active: true,
              report_data: null,
            },
          ])
          .select("id, report_name, uploaded_by, uploaded_at, is_active, storage_path, file_size, mime_type")
          .single();

        if (insertError) {
          console.error("Error registrando reporte:", insertError);
          return res.status(500).json({ error: "No se pudo registrar el nuevo reporte." });
        }

        const downloadUrl = await getSignedDownloadUrl(data.storage_path);

        return res.status(201).json({
          ok: true,
          report: {
            ...data,
            downloadUrl,
          },
        });
      }

      return res.status(400).json({ error: "Acción no válida." });
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
        .select("id, report_name, uploaded_by, uploaded_at, is_active, storage_path, file_size, mime_type, report_data")
        .single();

      if (activateError) {
        console.error("Error reactivando reporte:", activateError);
        return res.status(500).json({ error: "No se pudo reactivar el reporte." });
      }

      const downloadUrl = data.storage_path
        ? await getSignedDownloadUrl(data.storage_path)
        : null;

      return res.status(200).json({
        ok: true,
        report: {
          ...data,
          downloadUrl,
        },
      });
    } catch (error) {
      console.error("Error inesperado en PATCH /api/report:", error);
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "PATCH"]);
  return res.status(405).json({ error: "Method not allowed" });
}