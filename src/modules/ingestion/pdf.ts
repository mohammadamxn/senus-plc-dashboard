import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

/**
 * PDF → plain text (no OCR). Senus IR PDFs are text-based.
 */
export async function pdfBufferToText(buffer: ArrayBuffer | Buffer): Promise<{
  text: string;
  pageCount: number;
  pages: { page: number; text: string }[];
}> {
  const data = buffer instanceof Buffer ? new Uint8Array(buffer) : new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = (Array.isArray(text) ? text : [text]).map((t, i) => ({
    page: i + 1,
    text: (t ?? "").trim(),
  }));
  return {
    text: pages.map((p) => `--- page ${p.page} ---\n${p.text}`).join("\n\n"),
    pageCount: totalPages,
    pages,
  };
}
