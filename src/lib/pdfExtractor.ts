/**
 * Client-Side PDF Text Extraction
 * Runs 100% inside the browser memory. Zero server uploads.
 */

export async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.txt') || file.type === 'text/plain') {
    return await file.text();
  }

  if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
    return await extractTextFromPdf(file);
  }

  // Fallback to text reading
  return await file.text();
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const pdfjsLib = await import('pdfjs-dist');

    // Use cloudflare CDN worker matching pdfjs version or fallback
    if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      const version = pdfjsLib.version || '3.11.174';
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
    }

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const textLines: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const items = content.items as Array<{ str?: string; transform?: number[] }>;

      // Sort or group text items by vertical position Y descending, then X ascending
      // transform: [a, b, c, d, x, y]
      let lastY: number | null = null;
      let lineAccumulator = '';

      for (const item of items) {
        if (!item.str) continue;
        const y = item.transform ? Math.round(item.transform[5]) : null;

        if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
          textLines.push(lineAccumulator.trim());
          lineAccumulator = item.str;
        } else {
          if (lineAccumulator.length > 0 && !lineAccumulator.endsWith(' ')) {
            lineAccumulator += ' ' + item.str;
          } else {
            lineAccumulator += item.str;
          }
        }
        if (y !== null) {
          lastY = y;
        }
      }

      if (lineAccumulator.trim()) {
        textLines.push(lineAccumulator.trim());
      }
    }

    const fullExtracted = textLines.join('\n');
    if (fullExtracted.trim().length > 20) {
      return fullExtracted;
    }
  } catch (err) {
    console.warn('pdfjs-dist extraction notice:', err);
  }

  // Fallback raw text stream decoder for uncompressed/embedded PDF text
  return extractRawPdfTextFallback(arrayBuffer);
}

/**
 * Fallback binary text scanner for uncompressed PDF streams
 */
function extractRawPdfTextFallback(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let rawStr = '';
  // Convert first 500KB to string to find stream text chunks
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
