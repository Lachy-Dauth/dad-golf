export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "complete"
      ? "badge badge-complete"
      : status === "in_progress"
        ? "badge badge-active"
        : "badge badge-waiting";
  const label =
    status === "in_progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={cls}>{label}</span>;
}
