import { BADGE, type BadgeLevel } from "@/lib/confidence";

export default function ConfidenceBadge({ level }: { level: BadgeLevel }) {
  const b = BADGE[level];
  return (
    <span className={`badge ${b.className}`} title={b.label}>
      <span aria-hidden="true">{b.icon}</span>
      {b.label}
    </span>
  );
}
