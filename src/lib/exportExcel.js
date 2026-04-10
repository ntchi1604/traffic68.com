/**
 * exportExcel.js — Pure-JS .xlsx generator (no external deps)
 * Generates a real OpenXML spreadsheet (.xlsx) in the browser.
 *
 * Usage:
 *   import { exportToExcel } from '../lib/exportExcel';
 *   exportToExcel({
 *     filename: 'data.xlsx',
 *     sheetName: 'Sheet1',
 *     headers: ['STT', 'Keyword', ...],
 *     rows: [[1, 'keyword', ...], ...]
 *   });
 */

// ── Minimal base64 encoder for Uint8Array ──────────────────────────────────
const b64 = (arr) => {
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
};

// ── Escape XML special chars ───────────────────────────────────────────────
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── Convert JS date to Excel serial number ────────────────────────────────
const dateToSerial = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return String(d);
  // Excel epoch: Jan 1 1900. JS epoch: Jan 1 1970.
  return Math.round((dt.getTime() / 86400000) + 25569);
};

// Format date as string for display
const fmtDate = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

/**
 * Build the xl/worksheets/sheet1.xml content
 * @param {string[]} headers
 * @param {any[][]} rows
 * @param {string[]} [colTypes] - 's'=string, 'n'=number, 'd'=date, default auto
 * @returns {{ xml: string, strings: string[] }}
 */
function buildSheet(headers, rows, colTypes = []) {
  const sharedStrings = [];
  const strIndex = new Map();

  const addStr = (v) => {
    const s = String(v ?? '');
    if (!strIndex.has(s)) { strIndex.set(s, sharedStrings.length); sharedStrings.push(s); }
    return strIndex.get(s);
  };

  const colLetter = (n) => {
    let s = '';
    while (n >= 0) { s = String.fromCharCode((n % 26) + 65) + s; n = Math.floor(n / 26) - 1; }
    return s;
  };

  let rowsXml = '';
  // Header row
  let headerRow = '';
  for (let c = 0; c < headers.length; c++) {
    const ref = colLetter(c) + '1';
    const si = addStr(headers[c]);
    headerRow += `<c r="${ref}" t="s"><v>${si}</v></c>`;
  }
  rowsXml += `<row r="1">${headerRow}</row>`;

  // Data rows
  for (let r = 0; r < rows.length; r++) {
    const rowNum = r + 2;
    let rowXml = '';
    for (let c = 0; c < rows[r].length; c++) {
      const ref = colLetter(c) + rowNum;
      const val = rows[r][c];
      const ct = colTypes[c] || 'auto';

      if (val === null || val === undefined || val === '') {
        rowXml += `<c r="${ref}"/>`;
      } else if (ct === 'd' || (ct === 'auto' && (val instanceof Date || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/))))) {
        // Dates: store as formatted string for simplicity
        const si = addStr(fmtDate(val));
        rowXml += `<c r="${ref}" t="s"><v>${si}</v></c>`;
      } else if (ct === 'n' || (ct === 'auto' && typeof val === 'number' && !isNaN(val))) {
        rowXml += `<c r="${ref}" t="n"><v>${val}</v></c>`;
      } else {
        const si = addStr(val);
        rowXml += `<c r="${ref}" t="s"><v>${si}</v></c>`;
      }
    }
    rowsXml += `<row r="${rowNum}">${rowXml}</row>`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
           xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;

  return { xml, strings: sharedStrings };
}

/**
 * Build sharedStrings.xml
 */
function buildSharedStrings(strings) {
  const items = strings.map(s => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${items}</sst>`;
}

/**
 * Create a minimal .xlsx Blob using the ZIP format (no external library)
 * Uses a hand-crafted ZIP file with stored (uncompressed) entries.
 */
function createXlsxBlob(parts) {
  const te = new TextEncoder();
  const fileEntries = [];
  let offset = 0;

  for (const { name, content } of parts) {
    const nameBytes = te.encode(name);
    const dataBytes = typeof content === 'string' ? te.encode(content) : content;
    const crc = crc32(dataBytes);
    const localHeader = buildLocalFileHeader(nameBytes, dataBytes, crc);
    fileEntries.push({ nameBytes, dataBytes, crc, localHeaderOffset: offset, localHeader });
    offset += localHeader.length + dataBytes.length;
  }

  // Build central directory
  const cdEntries = [];
  for (const e of fileEntries) {
    cdEntries.push(buildCentralDirEntry(e.nameBytes, e.dataBytes, e.crc, e.localHeaderOffset));
  }
  const cdSize = cdEntries.reduce((s, b) => s + b.length, 0);
  const eocd = buildEndOfCentralDir(fileEntries.length, cdSize, offset);

  // Assemble
  const parts2 = [];
  for (const e of fileEntries) { parts2.push(e.localHeader); parts2.push(e.dataBytes); }
  for (const cd of cdEntries) parts2.push(cd);
  parts2.push(eocd);

  return new Blob(parts2, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ── CRC-32 ────────────────────────────────────────────────────────────────
function crc32(data) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })());
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u16le(n) { return [(n & 0xFF), ((n >> 8) & 0xFF)]; }
function u32le(n) { const v = n >>> 0; return [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF]; }

function buildLocalFileHeader(nameBytes, dataBytes, crc) {
  return new Uint8Array([
    0x50, 0x4B, 0x03, 0x04, // PK local file header sig
    20, 0,                   // version needed: 2.0
    0, 0,                    // general purpose bit flag
    0, 0,                    // compression: stored
    0, 0,                    // last mod time
    0, 0,                    // last mod date
    ...u32le(crc),           // CRC-32
    ...u32le(dataBytes.length), // compressed size
    ...u32le(dataBytes.length), // uncompressed size
    ...u16le(nameBytes.length), // file name length
    0, 0,                    // extra field length
    ...nameBytes,
  ]);
}

function buildCentralDirEntry(nameBytes, dataBytes, crc, localOffset) {
  return new Uint8Array([
    0x50, 0x4B, 0x01, 0x02, // central dir sig
    20, 0,                   // version made by
    20, 0,                   // version needed
    0, 0,                    // general bit flag
    0, 0,                    // compression
    0, 0,                    // last mod time
    0, 0,                    // last mod date
    ...u32le(crc),
    ...u32le(dataBytes.length),
    ...u32le(dataBytes.length),
    ...u16le(nameBytes.length),
    0, 0,                    // extra length
    0, 0,                    // file comment length
    0, 0,                    // disk start
    0, 0,                    // internal file attribs
    0, 0, 0, 0,              // external file attribs
    ...u32le(localOffset),   // relative offset of local header
    ...nameBytes,
  ]);
}

function buildEndOfCentralDir(count, cdSize, cdOffset) {
  return new Uint8Array([
    0x50, 0x4B, 0x05, 0x06, // EOCD sig
    0, 0,                    // disk number
    0, 0,                    // disk start of CD
    ...u16le(count),         // entries on disk
    ...u16le(count),         // total entries
    ...u32le(cdSize),        // size of CD
    ...u32le(cdOffset),      // offset of CD
    0, 0,                    // comment length
  ]);
}

// ── Static XML parts ───────────────────────────────────────────────────────
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const workbookXml = (sheetName) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

// ── Public API ─────────────────────────────────────────────────────────────
/**
 * Export data to a real .xlsx file and trigger browser download.
 *
 * @param {object} options
 * @param {string} options.filename     - Download filename (e.g. 'data.xlsx')
 * @param {string} [options.sheetName]  - Sheet tab name (default: 'Sheet1')
 * @param {string[]} options.headers    - Column header labels
 * @param {any[][]} options.rows        - 2D array of row data
 * @param {string[]} [options.colTypes] - Per-column type hints: 's','n','d','auto'
 */
export function exportToExcel({ filename, sheetName = 'Sheet1', headers, rows, colTypes = [] }) {
  const { xml: sheetXml, strings } = buildSheet(headers, rows, colTypes);
  const ssXml = buildSharedStrings(strings);

  const parts = [
    { name: '[Content_Types].xml', content: CONTENT_TYPES },
    { name: '_rels/.rels', content: RELS },
    { name: 'xl/workbook.xml', content: workbookXml(sheetName) },
    { name: 'xl/_rels/workbook.xml.rels', content: WORKBOOK_RELS },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml },
    { name: 'xl/sharedStrings.xml', content: ssXml },
  ];

  const blob = createXlsxBlob(parts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : filename + '.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
