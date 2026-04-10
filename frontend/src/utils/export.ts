import ExcelJS from 'exceljs'

export interface ExportColumn {
  key: string
  label: string
}

function sanitize(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export async function exportToXlsx(
  data: Record<string, unknown>[],
  filename: string,
  columns: ExportColumn[],
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Dados', {
    properties: { tabColor: { argb: '4F46E5' } },
  })

  sheet.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: 20,
  }))

  for (const row of data) {
    sheet.addRow(
      columns.reduce((acc, col) => {
        acc[col.key] = sanitize(row[col.key])
        return acc
      }, {} as Record<string, string>),
    )
  }

  sheet.getRow(1).font = { bold: true, size: 11 }
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  }

  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`)
}

export async function exportToCsv(
  data: Record<string, unknown>[],
  filename: string,
  columns: ExportColumn[],
): Promise<void> {
  const headerLine = columns.map((c) => `"${c.label}"`).join(',')
  const dataLines = data
    .map((row) =>
      columns
        .map((col) => `"${sanitize(row[col.key]).replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n')

  const csvContent = '\uFEFF' + headerLine + '\n' + dataLines
  downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`)
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
