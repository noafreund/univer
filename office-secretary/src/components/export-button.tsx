export function ExportButton({ table, label = 'ייצוא לאקסל' }: { table: string; label?: string }) {
  return (
    <a href={`/export/${table}`} className="btn btn-sm" download>
      📥 {label}
    </a>
  );
}
