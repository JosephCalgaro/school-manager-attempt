import { useState, useEffect, useCallback } from 'react'
import { Modal } from '../ui/modal'
import { useAuth } from '../../hooks/useAuth'
import { exportToXlsx, exportToCsv, ExportColumn } from '../../utils/export'

export interface DataSourceConfig {
  label: string
  apiEndpoint: string
  columns: ExportColumn[]
  dataKey?: string
  transform?: (raw: unknown) => Record<string, unknown>[]
}

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  apiBase?: string // kept for compatibility with callers; not used internally
  dataSource: DataSourceConfig
  defaultFilename?: string
}

export default function ExportModal({
  isOpen,
  onClose,
  dataSource,
  defaultFilename,
}: ExportModalProps) {
  const { authFetch } = useAuth()
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    () => new Set(dataSource.columns.map((c) => c.key)),
  )
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalAvailable, setTotalAvailable] = useState<number | null>(null)
  const [filename, setFilename] = useState(defaultFilename || 'export')

  const fetchTotal = useCallback(async () => {
    setFetching(true)
    try {
      const res = await authFetch(dataSource.apiEndpoint)
      if (!res.ok) return // silently ignore error status for total count
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) return // backend not reachable yet
      const json = await res.json()
      const items = dataSource.dataKey ? json[dataSource.dataKey] : json
      const arr = Array.isArray(items) ? items : json.data?.data || json.data || []
      setTotalAvailable(Array.isArray(arr) ? arr.length : 0)
    } catch {
      // silently ignore fetch errors for total count
    } finally {
      setFetching(false)
    }
  }, [authFetch, dataSource.apiEndpoint, dataSource.dataKey])

  useEffect(() => {
    if (isOpen) {
      setSelectedFields(new Set(dataSource.columns.map((c) => c.key)))
      setError(null)
      setTotalAvailable(null)
      setFilename(defaultFilename || 'export')
      fetchTotal()
    }
  }, [isOpen, fetchTotal, defaultFilename, dataSource.columns])

  const toggleField = (key: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedFields.size === dataSource.columns.length) {
      setSelectedFields(new Set())
    } else {
      setSelectedFields(new Set(dataSource.columns.map((c) => c.key)))
    }
  }

  const handleExport = async () => {
    if (selectedFields.size === 0) {
      setError('Selecione ao menos um campo')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await authFetch(dataSource.apiEndpoint)
      if (!res.ok) throw new Error(`Erro ao buscar dados (${res.status})`)
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        throw new Error('Resposta inesperada do servidor — verifique se o backend está rodando')
      }
      const json = await res.json()
      const rawItems = dataSource.dataKey ? json[dataSource.dataKey] : json
      let items: Record<string, unknown>[] = Array.isArray(rawItems)
        ? rawItems
        : json.data?.data || json.data || []

      if (dataSource.transform) {
        items = dataSource.transform(items)
      }

      const columns = dataSource.columns.filter((c) => selectedFields.has(c.key))
      const ts = new Date().toISOString().slice(0, 10)

      if (format === 'xlsx') {
        await exportToXlsx(items, `${filename}-${ts}`, columns)
      } else {
        await exportToCsv(items, `${filename}-${ts}`, columns)
      }

      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar arquivo'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
          Exportar Dados
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          {dataSource.label}
          {fetching ? (
            <span className="ml-2 text-xs text-gray-400">carregando...</span>
          ) : totalAvailable != null ? (
            <span className="ml-2 text-xs text-gray-400">
              {totalAvailable} registros disponiveis
            </span>
          ) : null}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Filename */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Nome do arquivo
          </label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            placeholder="nome-do-arquivo"
          />
        </div>

        {/* Format */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            Formato
          </label>
          <div className="flex gap-2">
            {(['xlsx', 'csv'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  format === f
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:border-brand-700 dark:text-brand-400'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                }`}
              >
                .{f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Fields */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Campos ({selectedFields.size}/{dataSource.columns.length})
            </label>
            <button
              onClick={toggleAll}
              className="text-xs text-brand-600 hover:underline dark:text-brand-400"
            >
              {selectedFields.size === dataSource.columns.length
                ? 'Desmarcar todos'
                : 'Selecionar todos'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            {dataSource.columns.map((col) => (
              <label
                key={col.key}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer text-xs transition-colors ${
                  selectedFields.has(col.key)
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedFields.has(col.key)}
                  onChange={() => toggleField(col.key)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="truncate">{col.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleExport}
            disabled={loading || selectedFields.size === 0}
            className="rounded-xl bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Gerando...
              </>
            ) : (
              `Gerar planilha .${format.toUpperCase()}`
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}
