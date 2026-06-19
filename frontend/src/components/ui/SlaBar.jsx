export function SlaBar({ sla }) {
  if (!sla || sla.status === 'Resolved') return null;

  const pct = Math.min(100, sla.percentElapsed);
  const barColor =
    sla.status === 'Breached'
      ? 'bg-red-500'
      : sla.status === 'At Risk'
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
