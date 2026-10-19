/**
 * Client-Side & Node-Compatible PDF Text Extraction
 * Extracts text from PDF files using PDF.js with 2D coordinate row reconstruction.
 * Runs 100% in browser memory (zero server uploads) and in test/Node environments.
 */

export interface TextItemCoord {
  str: string;
  x: number;
}

export interface RowBucket {
  y: number;
  items: TextItemCoord[];
}

/**
 * Loads the appropriate PDF.js build based on the current execution runtime.
 */
async function getPdfJsLib(): Promise<any> {
  if (typeof window === 'undefined') {
    // Node.js environment (e.g. tsx, test scripts, SSR)
    try {
      return await import('pdfjs-dist/legacy/build/pdf.mjs');
    } catch {
      return await import('pdfjs-dist');
    }
  }

  // Browser environment (client-side Next.js)
  const pdfjsLib = await import('pdfjs-dist');

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      // Use locally served worker from public/ directory
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    } catch {
      const version = pdfjsLib.version || '6.4.299';
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
    }
  }

  return pdfjsLib;
}

export async function extractTextFromFile(
  file: File | Blob | { name: string; arrayBuffer: () => Promise<ArrayBuffer>; text?: () => Promise<string> }
): Promise<string> {
  const fileName = (file && 'name' in file && typeof file.name === 'string' ? file.name : '').toLowerCase();

  if (fileName.endsWith('.txt')) {
    if (typeof (file as any).text === 'function') {
      return await (file as any).text();
    }
    const buf = await file.arrayBuffer();
    return new TextDecoder().decode(buf);
  }

  return await extractTextFromPdf(file);
}

export async function extractTextFromPdf(
  bufferOrFile:
    | File
    | Blob
    | ArrayBuffer
    | Uint8Array
    | { arrayBuffer: () => Promise<ArrayBuffer> }
): Promise<string> {
  let arrayBuffer: ArrayBuffer;

  if (bufferOrFile instanceof ArrayBuffer) {
    arrayBuffer = bufferOrFile;
  } else if (bufferOrFile instanceof Uint8Array) {
    arrayBuffer = bufferOrFile.buffer.slice(
      bufferOrFile.byteOffset,
      bufferOrFile.byteOffset + bufferOrFile.byteLength
    ) as ArrayBuffer;
  } else if (
    bufferOrFile &&
    typeof bufferOrFile === 'object' &&
    'arrayBuffer' in bufferOrFile &&
    typeof bufferOrFile.arrayBuffer === 'function'
  ) {
    arrayBuffer = await bufferOrFile.arrayBuffer();
  } else {
    throw new Error('Unsupported buffer or file type provided to extractTextFromPdf');
  }

  try {
    const pdfjsLib = await getPdfJsLib();

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const items = content.items as Array<{ str?: string; transform?: number[] }>;

      const rows: RowBucket[] = [];

      for (const item of items) {
        if (!item || typeof item.str !== 'string') continue;
        const text = item.str;
        if (!text && text !== ' ') continue;

        const x = item.transform && item.transform.length >= 6 ? item.transform[4] : 0;
        const y = item.transform && item.transform.length >= 6 ? item.transform[5] : 0;

        // Group TextItems that share the same horizontal row using a vertical Y-coordinate tolerance (<= 3pt)
        let matchedRow = rows.find((r) => Math.abs(r.y - y) <= 3);
        if (!matchedRow) {
          matchedRow = { y, items: [] };
          rows.push(matchedRow);
        }
        matchedRow.items.push({ str: text, x });
      }

      // Sort rows top-to-bottom (Y descending)
      rows.sort((a, b) => b.y - a.y);

      // Sort items within each row left-to-right (X ascending) and join them with spaces
      const pageLines = rows
        .map((r) => {
          r.items.sort((a, b) => a.x - b.x);
          return r.items
            .map((i) => i.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        })
        .filter((line) => line.length > 0);

      if (pageLines.length > 0) {
        pageTexts.push(pageLines.join('\n'));
      }
    }

    const fullExtracted = pageTexts.join('\n\n---PAGE_BREAK---\n\n');
    if (fullExtracted.trim().length > 20) {
      return fullExtracted;
    }
  } catch (err) {
    console.warn('pdfjs-dist extraction error, falling back:', err);
  }

  // Fallback binary text scanner for uncompressed/embedded PDF text
  return extractRawPdfTextFallback(arrayBuffer);
}

/**
 * Fallback binary text scanner for uncompressed PDF streams
 */
function extractRawPdfTextFallback(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let rawStr = '';
  const len = Math.min(bytes.length, 1024 * 512);
  for (let i = 0; i < len; i++) {
    rawStr += String.fromCharCode(bytes[i]);
  }

  const matches = rawStr.match(/\(([^()]+)\)\s*Tj/g) || [];
  const extracted = matches
    .map((m) => {
      const match = m.match(/\(([^()]+)\)\s*Tj/);
      return match ? match[1] : '';
    })
    .join(' ');

  return extracted || rawStr.replace(/[^\x20-\x7E\r\n]/g, ' ');
}
