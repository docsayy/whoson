export type ExportRow = Record<string, string | number | null | undefined>;

function cleanCsvValue(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, rows: ExportRow[]) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);

  const csv = [
    headers.map(cleanCsvValue).join(","),
    ...rows.map((row) =>
      headers.map((header) => cleanCsvValue(row[header])).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

export function printCurrentPage() {
  window.print();
}