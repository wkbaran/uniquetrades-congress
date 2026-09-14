/**
 * Render scanned filing pages (PDF pages or single-page images) to grayscale PNG
 * for vision-model OCR, using MuPDF's WebAssembly build (no native dependencies).
 */
import * as mupdf from "mupdf";

export type Rotation = 0 | 90 | 180 | 270;

export interface RenderedPage {
  png: Buffer;
  width: number;
  height: number;
}

/** One page of a scanned filing, renderable at any rotation. */
export interface PageSource {
  /** Orientation as scanned (taller than wide) */
  portrait: boolean;
  render(rotation: Rotation): RenderedPage;
}

// Long edge of the rendered image: ~150 DPI for a letter-size page, legible for OCR
// while keeping the image small enough for the model
const TARGET_LONG_EDGE = 1650;

/** Open a PDF or image (GIF/PNG/JPEG) and expose each page for rendering. */
export function pagesFromDocument(bytes: Uint8Array, mimeType: string): PageSource[] {
  const doc = mupdf.Document.openDocument(bytes, mimeType);
  const pages: PageSource[] = [];

  for (let i = 0; i < doc.countPages(); i++) {
    const page = doc.loadPage(i);
    const [x0, y0, x1, y1] = page.getBounds();
    const width = x1 - x0;
    const height = y1 - y0;
    const scale = TARGET_LONG_EDGE / Math.max(width, height);

    pages.push({
      portrait: height > width,
      render(rotation) {
        const matrix = mupdf.Matrix.concat(mupdf.Matrix.scale(scale, scale), mupdf.Matrix.rotate(rotation));
        const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceGray, false, true);
        return { png: Buffer.from(pixmap.asPNG()), width: pixmap.getWidth(), height: pixmap.getHeight() };
      },
    });
  }

  return pages;
}

/**
 * Rotations to try, best guess first. Each form has a fixed orientation (House paper
 * PTRs are landscape, Senate paper PTRs portrait), so a page scanned the other way is
 * sideways; in the filings seen so far a 270° turn rights it. The model reads a
 * sideways page into confident garbage rather than an error, so pages must be righted
 * before OCR, not after.
 */
export function rotationCandidates(pagePortrait: boolean, formLandscape: boolean): Rotation[] {
  const sideways = pagePortrait === formLandscape;
  return sideways ? [270, 90] : [0, 180];
}
