import { Upload } from "lucide-react";

export default function UploadVTEX({ onFileChange }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-amber-950">Cargar reporte VTEX</h3>
          <p className="text-sm text-stone-500">
            Subí el CSV exportado desde VTEX para actualizar el dashboard
          </p>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-amber-700 px-4 py-3 text-sm font-medium text-white hover:bg-amber-800">
          <Upload size={16} />
          Seleccionar CSV
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0])}
          />
        </label>
      </div>
    </div>
  );
}