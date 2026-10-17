export function downloadJSON(text: string, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
