/**
 * A tiny but valid one-page PDF, so the preview can be exercised in a real browser. There is no cross-reference
 * table; PDF readers rebuild it. Only ASCII is used because the built-in Helvetica font has no Azerbaijani letters.
 */
export function demoPdf(title: string): Uint8Array {
  const text = title.replace(/[^\x20-\x7e]/g, "?").replace(/[()\\]/g, "");
  const stream = `BT /F1 20 Tf 60 760 Td (${text}) Tj 0 -30 Td (Demo document - not a real invoice) Tj ET`;
  const pdf = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
    `4 0 obj<</Length ${stream.length}>>stream`,
    stream,
    "endstream endobj",
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
    "trailer<</Root 1 0 R/Size 6>>",
    "%%EOF",
    "",
  ].join("\n");
  return new TextEncoder().encode(pdf);
}
