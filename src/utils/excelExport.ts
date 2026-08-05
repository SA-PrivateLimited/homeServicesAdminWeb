/**
 * Build and download an Excel-friendly spreadsheet (.xls SpreadsheetML).
 * Opens natively in Excel / Google Sheets without extra npm packages.
 */

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadExcelSpreadsheet(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): void {
  const headerRow = `<Row>${headers
    .map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`)
    .join('')}</Row>`;

  const dataRows = rows
    .map((row) => {
      const cells = headers.map((_, i) => {
        const raw = row[i];
        if (raw == null || raw === '') {
          return `<Cell><Data ss:Type="String"></Data></Cell>`;
        }
        if (typeof raw === 'number' && Number.isFinite(raw)) {
          return `<Cell><Data ss:Type="Number">${raw}</Data></Cell>`;
        }
        return `<Cell><Data ss:Type="String">${xmlEscape(raw)}</Data></Cell>`;
      });
      return `<Row>${cells.join('')}</Row>`;
    })
    .join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="${xmlEscape(sheetName.slice(0, 31))}">
  <Table>
   ${headerRow}
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  a.href = url;
  a.download = safeName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
