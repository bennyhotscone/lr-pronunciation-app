/** True when the file looks like a PDF by MIME or extension. */
export function isPdfFile(file: { type?: string; name?: string }): boolean {
  const mime = (file.type || "").toLowerCase();
  if (mime === "application/pdf") return true;
  return (file.name || "").toLowerCase().endsWith(".pdf");
}
