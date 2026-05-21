import { useState, useCallback } from 'react'
import { Modal } from '../ui/modal'
import { useAuth } from '../../hooks/useAuth'
import { parseFile, autoMapColumns, prepareLeadsForImport, ParsedLead, ValidationError } from '../../utils/import'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  apiBase: string
}

type Step = 'upload' | 'preview' | 'result'

function getCellErrors(errors: ValidationError[], field: string): string | null {
  const err = errors.find(e => e.field === field)
  return err ? err.message : null
}

export default function ImportModal({ isOpen, onClose, onSuccess, apiBase }: ImportModalProps) {
  const { authFetch } = useAuth()
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [preview, setPreview] = useState<ParsedLead[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: unknown[] } | null>(null)
  const [missingEssential, setMissingEssential] = useState<string[]>([])

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile)
    setError(null)
    setResult(null)

    try {
      const { headers: h, rows: r, preview: p, missingEssential: miss } = await parseFile(selectedFile)
      setHeaders(h)
      setRows(r)
      setPreview(p)
      setColumnMapping(autoMapColumns(h))
      setMissingEssential(miss)
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao processar arquivo')
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      const ext = droppedFile.name.split('.').pop()?.toLowerCase()
      if (['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
        handleFileSelect(droppedFile)
      } else {
        setError('Formato não suportado. Use .xlsx, .xls ou .csv')
      }
    }
  }, [handleFileSelect])

  const handleImport = useCallback(async () => {
    if (!file || importing) return
    setImporting(true)
    setError(null)

    try {
      const leads = prepareLeadsForImport(rows, columnMapping)
      const res = await authFetch(`${apiBase}/crm/leads/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao importar')
      setResult({ imported: data.imported, skipped: data.skipped, errors: data.errors || [] })
      setStep('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao importar')
    } finally {
      setImporting(false)
    }
  }, [file, rows, columnMapping, authFetch, apiBase, importing])

  const handleClose = () => {
    setStep('upload')
    setFile(null)
    setHeaders([])
    setRows([])
    setPreview([])
    setColumnMapping({})
    setError(null)
    setResult(null)
    onClose()
  }

  const handleSuccess = () => {
    onSuccess()
    handleClose()
  }

  const validCount = preview.filter(p => p.isValid).length
  const invalidCount = preview.length - validCount

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-2xl">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Importar Leads</h2>
        <p className="text-sm text-gray-500 mb-5">Importar leads de arquivo .xlsx, .xls ou .csv</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {step === 'upload' && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById('import-file-input')?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-brand-500 dark:hover:border-brand-500 transition-colors"
          >
            <input
              id="import-file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileSelect(f)
              }}
            />
            <div className="text-4xl mb-3">📄</div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Arraste o arquivo aqui ou <span className="text-brand-600 font-medium">clique para selecionar</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">Suporta .xlsx, .xls e .csv</p>
          </div>
        )}

        {step === 'preview' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm">
                <span className="font-medium text-gray-900  dark:text-white mb-1">{rows.length} registros encontrados</span>
                <span className="ml-3 text-green-600 dark:text-green-400">{validCount} válidos</span>
                {invalidCount > 0 && (
                  <span className="ml-2 text-red-600 dark:text-red-400">{invalidCount} com erro</span>
                )}
              </div>
              <button
                onClick={() => setStep('upload')}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ← Escolher outro arquivo
              </button>
            </div>

            <div className="max-h-64 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-500">#</th>
                    {headers.slice(0, 6).map(h => (
                      <th key={h} className="px-2 py-1.5 text-left font-medium text-gray-500 truncate max-w-24">{h}</th>
                    ))}
                    {headers.length > 6 && <th className="px-2 py-1.5 text-gray-400">+{headers.length - 6}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {preview.slice(0, 20).map((lead) => {
                    const mappedFields = headers.slice(0, 6).map(h => columnMapping[h] || h)
                    return (
                      <tr key={lead.row} style={lead.isValid ? undefined : { backgroundColor: '#805b00' }} className={lead.isValid ? '' : 'dark:bg-yellow-950/40'}>
                        <td style={lead.isValid ? undefined : { backgroundColor: '#805b00' }} className="px-2 py-1.5 text-white">{lead.row}</td>
                        {mappedFields.map((field) => {
                          const errMsg = getCellErrors(lead.errors, field)
                          return (
                            <td key={field} style={lead.isValid ? undefined : { backgroundColor: '#805b00' }} className="px-2 py-1.5 truncate max-w-24">
                              <span className={errMsg ? 'text-red-500 font-semibold' : 'text-gray-700 dark:text-gray-200'}>
                                {lead.data[field] || ''}
                              </span>
                            </td>
                          )
                        })}
                        {headers.length > 6 && <td style={lead.isValid ? undefined : { backgroundColor: '#805b00' }} className="px-2 py-1.5 text-gray-400" />}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {preview.length > 20 && (
                <p className="text-xs text-gray-400 text-center py-2">Mostrando 20 de {preview.length} registros</p>
              )}
            </div>

            {invalidCount > 0 && (
              <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-700 dark:bg-yellow-950/30 dark:border-yellow-800 dark:text-yellow-400">
                {invalidCount} registros têm erros e serão ignorados na importação
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={handleClose}
                className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={validCount === 0 || importing}
                className="rounded-xl bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
              >
                {importing && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {importing ? 'Importando...' : `Importar ${validCount} leads`}
              </button>
              {missingEssential.length > 0 && (
                <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Colunas essenciais não mapeadas: {missingEssential.join(', ')}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="text-center py-4">
            <div className="text-5xl mb-3">✅</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Importação concluída</h3>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-medium text-green-600">{result.imported}</span> importados
              {result.skipped > 0 && (
                <>
                  {' '}<span className="font-medium text-yellow-600">{result.skipped}</span> ignorados (duplicados)
                </>
              )}
            </p>
            <button
              onClick={handleSuccess}
              className="rounded-xl bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}