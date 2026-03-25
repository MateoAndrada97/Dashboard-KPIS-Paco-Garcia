export default function KpiCard({ title, value, helper }) {
  return (
    <div className="pg-card pg-pattern-soft relative rounded-3xl p-5">
      <p className="text-sm text-[var(--pg-deep)]/70">{title}</p>
      <h3 className="pg-display mt-2 text-4xl text-[var(--pg-deep)]">{value}</h3>
      {helper ? <p className="mt-2 text-sm text-[var(--pg-charcoal)]/58">{helper}</p> : null}
    </div>
  );
}