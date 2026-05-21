import ExcelJS from 'exceljs'

export interface LeadDraft {
  name?: string
  phone?: string
  email?: string
  cpf?: string
  rg?: string
  student_name?: string
  age_range?: string
  source?: string
  notes?: string
  tags?: string
  expected_enrollment_date?: string
  [key: string]: string | undefined
}

export interface ValidationError {
  row: number
  field: string
  message: string
}

export interface ParsedLead {
  row: number
  data: LeadDraft
  errors: ValidationError[]
  isValid: boolean
}

const ESSENTIAL_FIELDS = ['name', 'email', 'cpf', 'rg', 'phone'] as const

const KNOWN_HEADERS = [
  'name', 'phone', 'email', 'cpf', 'rg',
  'student_name', 'age_range', 'source', 'notes', 'tags',
  'expected_enrollment_date',
]

const HEADER_ALIASES: Record<string, string[]> = {
  name: ['nome', 'name', 'nombre', 'nome completo'],
  phone: ['telefone', 'phone', 'tel', 'celular', 'cel', 'whatsapp', 'fone'],
  email: ['email', 'e-mail', 'mail', 'correo'],
  cpf: ['cpf', 'documento'],
  rg: ['rg', 'documento rg', 'registro geral'],
}

const MAX_FILE_SIZE = 10 * 1024 * 1024

function normalizeHeader(header: string): string {
  const h = header.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some(a => h.includes(a))) return canonical
  }
  return h
}

function normalizePhone(value: string): string {
  if (!value) return ''
  return value.replace(/\D/g, '')
}

function normalizeCpf(value: string): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) {
    const padded = '0' + digits
    if (validateCpf(padded)) return padded
    return digits
  }
  return digits
}

function validateCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i)
  let rest = (sum * 10) % 11
  if (rest === 10) rest = 0
  if (rest !== parseInt(d[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i)
  rest = (sum * 10) % 11
  if (rest === 10) rest = 0
  return rest === parseInt(d[10])
}

function validateLead(data: LeadDraft, row: number): ValidationError[] {
  const errors: ValidationError[] = []

  if (!data.name?.trim()) {
    errors.push({ row, field: 'name', message: 'Nome obrigatório' })
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
    errors.push({ row, field: 'email', message: 'Email inválido' })
  }
  if (data.cpf && data.cpf.replace(/\D/g, '').length === 11 && !validateCpf(data.cpf)) {
    errors.push({ row, field: 'cpf', message: 'CPF inválido' })
  }
  if (data.cpf && data.cpf.replace(/\D/g, '').length > 0 && data.cpf.replace(/\D/g, '').length !== 11) {
    errors.push({ row, field: 'cpf', message: 'CPF deve ter 11 dígitos' })
  }
  if (data.phone && normalizePhone(data.phone).length > 0 && normalizePhone(data.phone).length < 10) {
    errors.push({ row, field: 'phone', message: 'Telefone deve ter pelo menos 10 dígitos' })
  }

  return errors
}

export function checkEssentialColumns(mappedHeaders: string[]): string[] {
  return [...ESSENTIAL_FIELDS].filter(f => !mappedHeaders.includes(f))
}

export async function parseFile(file: File): Promise<{
  headers: string[]
  rows: Record<string, string>[]
  preview: ParsedLead[]
  missingEssential: string[]
}> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Arquivo muito grande. Tamanho máximo: 10MB')
  }

  const ext = file.name.split('.').pop()?.toLowerCase()

  let rawData: Record<string, string>[] = []

  if (ext === 'xlsx' || ext === 'xls') {
    rawData = await parseXlsx(file)
  } else if (ext === 'csv') {
    rawData = await parseCsv(file)
  } else {
    throw new Error('Formato não suportado. Use .xlsx, .xls ou .csv')
  }

  if (rawData.length === 0) {
    throw new Error('Arquivo vazio ou sem dados')
  }

  const headers = Object.keys(rawData[0])
  const normalizedHeaders = headers.map(normalizeHeader)
  const missingEssential = checkEssentialColumns(normalizedHeaders)

  const preview = rawData.slice(0, 100).map((row, idx) => {
    const data: LeadDraft = {}
    for (let i = 0; i < headers.length; i++) {
      const normalized = normalizedHeaders[i]
      const value = row[headers[i]]?.trim() ?? ''
      if (!value) continue
      if (normalized === 'cpf') {
        data[normalized] = normalizeCpf(value)
      } else if (normalized === 'phone') {
        data[normalized] = normalizePhone(value)
      } else {
        data[normalized] = value
      }
    }
    const errors = validateLead(data, idx + 2)
    return { row: idx + 2, data, errors, isValid: errors.length === 0 }
  })

  return { headers, rows: rawData, preview, missingEssential }
}

async function parseXlsx(file: File): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook()
  const buffer = await file.arrayBuffer()
  await workbook.xlsx.load(buffer)

  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('Planilha não encontrada')

  const data: Record<string, string>[] = []
  const headerRow = sheet.getRow(1)
  const headers: string[] = []
  headerRow.eachCell((cell, colNum) => {
    headers[colNum - 1] = String(cell.value ?? '').trim()
  })

  const validHeaders = headers.filter(Boolean)
  if (validHeaders.length === 0) throw new Error('Nenhuma coluna encontrada na primeira linha')

  sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return
    const rowData: Record<string, string> = {}
    row.eachCell((cell, colNum) => {
      const header = headers[colNum - 1]
      if (header) {
        const val = cell.value
        let strVal: string
        if (val instanceof Date) {
          strVal = val.toISOString().split('T')[0]
        } else if (typeof val === 'number') {
          strVal = cell.text ? String(cell.text) : String(val)
        } else if (val && typeof val === 'object') {
          if ('text' in val && typeof (val as { text?: unknown }).text === 'string') {
            strVal = (val as { text: string }).text
          } else if ('value' in val && typeof (val as { value?: unknown }).value === 'string') {
            strVal = (val as { value: string }).value
          } else if (Array.isArray(val)) {
            strVal = (val as unknown[]).map(v => typeof v === 'object' && v && 'text' in v ? (v as { text: string }).text : String(v)).join('')
          } else {
            strVal = JSON.stringify(val)
          }
        } else {
          strVal = String(val ?? '').trim()
        }
        rowData[header] = strVal
      }
    })
    if (Object.values(rowData).some(v => v)) {
      data.push(rowData)
    }
  })

  return data
}

function detectDelimiter(line: string): string {
  const semis = (line.match(/;/g) || []).length
  const commas = (line.match(/,/g) || []).length
  return semis > commas ? ';' : ','
}

async function parseCsv(file: File): Promise<Record<string, string>[]> {
  const text = await file.text()
  const cleanText = text.startsWith('\uFEFF') ? text.slice(1) : text
  const lines = cleanText.split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) return []

  const delimiter = detectDelimiter(lines[0])

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const data: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i])
    const rowData: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      rowData[headers[j]] = values[j] ?? ''
    }
    if (Object.values(rowData).some(v => v)) {
      data.push(rowData)
    }
  }

  return data
}

export function autoMapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  for (const header of headers) {
    const normalized = normalizeHeader(header)
    if (KNOWN_HEADERS.includes(normalized)) {
      mapping[header] = normalized
    }
  }
  return mapping
}

export function prepareLeadsForImport(
  rows: Record<string, string>[],
  columnMapping: Record<string, string>
): LeadDraft[] {
  return rows.map(row => {
    const lead: LeadDraft = {}
    for (const [rawCol, normalizedField] of Object.entries(columnMapping)) {
      const value = row[rawCol]?.trim() ?? ''
      if (!value) continue

      if (normalizedField === 'phone') {
        lead[normalizedField] = normalizePhone(value)
      } else if (normalizedField === 'cpf') {
        lead[normalizedField] = normalizeCpf(value)
      } else {
        lead[normalizedField] = value
      }
    }
    return lead
  })
}

export function validateAllLeads(leads: LeadDraft[]): ParsedLead[] {
  return leads.map((data, idx) => {
    const errors = validateLead(data, idx + 2)
    return { row: idx + 2, data, errors, isValid: errors.length === 0 }
  })
}
