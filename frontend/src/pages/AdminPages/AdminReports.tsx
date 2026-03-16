import { useState, useEffect, useCallback } from 'react'
import ReactApexChart from 'react-apexcharts'
import { useAuth } from '../../hooks/useAuth'
import PageMeta from '../../components/common/PageMeta'
import {
  LuChartBar, LuLock, LuTrendingUp, LuTrendingDown,
  LuUsers, LuMapPin, LuAward, LuActivity, LuRefreshCw,
} from 'react-icons/lu'

// ── Types ─────────────────────────────────────────────────────────────────────
type MonthPt = { label: string; total: number }
type YearReviewMonth = { label: string; matriculas: number; cancelamentos: number; liquido: number }
type YearReview = { year: number; totalEnrollments: number; totalCancellations: number; data: YearReviewMonth[] }
type CancelMonth = { label: string; [k: string]: number | string }
type Cancellations = { year: number; reasons: string[]; data: CancelMonth[] }
type AttStudent = { id: number; full_name: string; total: number; present: number; rate: number | null }
type SecRank = { id: number; full_name: string; enrollments: number }
type SecRanking = { month: number; year: number; data: SecRank[] }
type CrmConv = { totalLeads: number; matriculados: number; perdidos: number; emAndamento: number; conversionRate: number }
type CityRow = { city: string; total: number }

// ── Paleta de cores ───────────────────────────────────────────────────────────
const BRAND   = '#465FFF'
const SUCCESS = '#10B981'
const DANGER  = '#EF4444'
const WARNING = '#F59E0B'
const COLORS  = [BRAND, SUCCESS, WARNING, DANGER, '#8B5CF6', '#06B6D4', '#EC4899', '#F97316']

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// ── Helpers ───────────────────────────────────────────────────────────────────
function baseOpts(categories: string[]) {
  return {
    chart: { toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
    xaxis: { categories, labels: { style: { colors: '#9CA3AF', fontSize: '11px' } } },
    yaxis: { labels: { style: { colors: '#9CA3AF' } } },
    grid:  { borderColor: '#374151', strokeDashArray: 4 },
    tooltip: { theme: 'dark' },
    legend: { labels: { colors: '#D1D5DB' } },
  }
}

function Card({ title, icon, children, className = '' }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 ${className}`}>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
        <span className="text-brand-500">{icon}</span>{title}
      </h3>
      {children}
    </div>
  )
}

function Skeleton() {
  return <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminReports() {
  const { authFetch } = useAuth()
  const [tab, setTab]     = useState<'pedagogico' | 'financeiro'>('pedagogico')
  const [year, setYear]   = useState(new Date().getFullYear())
  const [rankMonth, setRankMonth] = useState(new Date().getMonth()) // 0-indexed for display

  const [loading, setLoading]             = useState(true)
  const [yearReview, setYearReview]       = useState<YearReview | null>(null)
  const [enrollments, setEnrollments]     = useState<MonthPt[]>([])
  const [cancellations, setCancellations] = useState<Cancellations | null>(null)
  const [attendance, setAttendance]       = useState<AttStudent[]>([])
  const [secretaryRank, setSecretaryRank] = useState<SecRanking | null>(null)
  const [crmConv, setCrmConv]             = useState<CrmConv | null>(null)
  const [cities, setCities]               = useState<CityRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const m = rankMonth + 1
      const [yrRes, enrRes, canRes, attRes, secRes, crmRes, citRes] = await Promise.all([
        authFetch(`/admin/reports/year-review?year=${year}`),
        authFetch(`/admin/reports/enrollments-by-month?year=${year}`),
        authFetch(`/admin/reports/cancellations-by-month?year=${year}`),
        authFetch('/admin/reports/attendance-all'),
        authFetch(`/admin/reports/secretary-ranking?year=${year}&month=${m}`),
        authFetch('/admin/reports/crm-conversion'),
        authFetch('/admin/reports/cities'),
      ])
      if (yrRes.ok)  setYearReview(await yrRes.json())
      if (enrRes.ok) setEnrollments((await enrRes.json()).data ?? [])
      if (canRes.ok) setCancellations(await canRes.json())
      if (attRes.ok) setAttendance(await attRes.json())
      if (secRes.ok) setSecretaryRank(await secRes.json())
      if (crmRes.ok) setCrmConv(await crmRes.json())
      if (citRes.ok) setCities(await citRes.json())
    } finally { setLoading(false) }
  }, [authFetch, year, rankMonth])

  useEffect(() => { load() }, [load])

  // ── Year Review Chart ──────────────────────────────────────────────────────
  const yearReviewChart = yearReview ? {
    series: [
      { name: 'Matrículas',    type: 'bar',  data: yearReview.data.map(d => d.matriculas) },
      { name: 'Cancelamentos', type: 'bar',  data: yearReview.data.map(d => d.cancelamentos) },
      { name: 'Crescimento líquido', type: 'line', data: yearReview.data.map(d => d.liquido) },
    ],
    options: {
      ...baseOpts(MONTH_NAMES),
      chart: { type: 'line', toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
      stroke: { width: [0, 0, 3], curve: 'smooth' },
      colors: [BRAND, DANGER, SUCCESS],
      plotOptions: { bar: { columnWidth: '40%', borderRadius: 4 } },
      tooltip: { theme: 'dark', shared: true, intersect: false },
      legend: { labels: { colors: '#D1D5DB' } },
    },
  } : null

  // ── Matrículas Bar Chart ───────────────────────────────────────────────────
  const enrChart = {
    series: [{ name: 'Matrículas', data: enrollments.map(d => d.total) }],
    options: {
      ...baseOpts(enrollments.map(d => d.label)),
      colors: [BRAND],
      plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
      dataLabels: { enabled: false },
    },
  }

  // ── Cancelamentos Stacked Bar ─────────────────────────────────────────────
  const canChart = cancellations && cancellations.reasons.length > 0 ? {
    series: cancellations.reasons.map((reason) => ({
      name: reason,
      data: cancellations.data.map(d => (d[reason] as number) ?? 0),
    })),
    options: {
      ...baseOpts(MONTH_NAMES),
      chart: { type: 'bar', stacked: true, toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
      colors: COLORS,
      plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } },
      dataLabels: { enabled: false },
      tooltip: { theme: 'dark', shared: true, intersect: false },
      legend: { labels: { colors: '#D1D5DB' } },
    },
  } : null

  // ── CRM Donut ─────────────────────────────────────────────────────────────
  const crmChart = crmConv ? {
    series: [crmConv.matriculados, crmConv.emAndamento, crmConv.perdidos],
    options: {
      chart: { type: 'donut', toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
      labels: ['Matriculados', 'Em andamento', 'Perdidos'],
      colors: [SUCCESS, BRAND, DANGER],
      legend: { labels: { colors: '#D1D5DB' } },
      dataLabels: { style: { colors: ['#fff'] } },
      tooltip: { theme: 'dark' },
      plotOptions: { pie: { donut: { size: '65%' } } },
    },
  } : null

  // ── Cidades Horizontal Bar ─────────────────────────────────────────────────
  const citiesChart = cities.length > 0 ? {
    series: [{ name: 'Alunos', data: cities.slice(0, 10).map(c => c.total) }],
    options: {
      chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '60%' } },
      xaxis: { categories: cities.slice(0, 10).map(c => c.city), labels: { style: { colors: '#9CA3AF' } } },
      yaxis: { labels: { style: { colors: '#9CA3AF' } } },
      colors: [BRAND],
      dataLabels: { enabled: true, style: { colors: ['#fff'], fontSize: '11px' } },
      grid: { borderColor: '#374151', strokeDashArray: 4 },
      tooltip: { theme: 'dark' },
    },
  } : null

  // ── Attendance color helper ─────────────────────────────────────────────────
  const rateColor = (r: number | null) => {
    if (r === null) return 'text-gray-400'
    if (r >= 75)   return 'text-green-600 dark:text-green-400'
    if (r >= 50)   return 'text-amber-500 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
  }
  const barColor = (r: number | null) => {
    if (r === null) return 'bg-gray-300 dark:bg-gray-600'
    if (r >= 75)   return 'bg-green-500'
    if (r >= 50)   return 'bg-amber-400'
    return 'bg-red-500'
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta title="Relatórios | Escola" description="Relatórios pedagógicos e financeiros" />
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Relatórios</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Visão analítica da escola</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={load} disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-750 disabled:opacity-50">
              <LuRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/50 w-fit">
          {(['pedagogico', 'financeiro'] as const).map(t => (
            <button key={t} onClick={() => t === 'pedagogico' && setTab(t)}
              className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all
                ${tab === t
                  ? 'bg-white text-brand-600 shadow-sm dark:bg-gray-800 dark:text-brand-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                } ${t === 'financeiro' ? 'cursor-not-allowed opacity-60' : ''}`}>
              {t === 'pedagogico' ? <LuChartBar className="h-4 w-4" /> : <LuLock className="h-4 w-4" />}
              {t === 'pedagogico' ? 'Pedagógico' : 'Financeiro'}
              {t === 'financeiro' && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">Em breve</span>}
            </button>
          ))}
        </div>

        {/* ── Tab: Financeiro placeholder ── */}
        {tab === 'financeiro' && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-24 dark:border-gray-700">
            <LuLock className="mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Relatórios Financeiros</p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Disponível após a implementação do módulo financeiro</p>
          </div>
        )}

        {/* ── Tab: Pedagógico ── */}
        {tab === 'pedagogico' && (
          <div className="space-y-6">

            {/* KPIs do ano */}
            {yearReview && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: 'Matrículas no ano',    value: yearReview.totalEnrollments,    icon: <LuTrendingUp />,   color: 'border-l-brand-500 dark:border-l-brand-400' },
                  { label: 'Cancelamentos no ano',  value: yearReview.totalCancellations,  icon: <LuTrendingDown />, color: 'border-l-red-500' },
                  { label: 'Crescimento líquido',   value: yearReview.totalEnrollments - yearReview.totalCancellations, icon: <LuActivity />, color: 'border-l-green-500' },
                  { label: 'Alunos com frequência', value: attendance.length,              icon: <LuUsers />,        color: 'border-l-purple-500' },
                ].map(k => (
                  <div key={k.label} className={`rounded-xl border-l-4 bg-white p-4 shadow-sm dark:bg-gray-800 ${k.color}`}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{k.label}</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{k.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Review do Ano */}
            <Card title={`Visão Geral do Ano ${year}`} icon={<LuTrendingUp className="h-4 w-4" />}>
              {loading ? <Skeleton /> : yearReviewChart ? (
                <ReactApexChart options={yearReviewChart.options as never} series={yearReviewChart.series} type="line" height={280} />
              ) : <p className="text-sm text-gray-400 text-center py-12">Sem dados para {year}</p>}
            </Card>

            {/* Matrículas/mês + Cancelamentos por motivo */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Matrículas por Mês" icon={<LuChartBar className="h-4 w-4" />}>
                {loading ? <Skeleton /> : (
                  <ReactApexChart options={enrChart.options as never} series={enrChart.series} type="bar" height={240} />
                )}
              </Card>

              <Card title="Cancelamentos por Motivo" icon={<LuTrendingDown className="h-4 w-4" />}>
                {loading ? <Skeleton /> : canChart ? (
                  <ReactApexChart options={canChart.options as never} series={canChart.series} type="bar" height={240} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-sm text-gray-400">
                    <LuTrendingDown className="mb-2 h-8 w-8 opacity-30" />
                    Sem cancelamentos registrados em {year}
                    <span className="mt-1 text-xs opacity-70">(requer campo "motivo" ao desativar aluno)</span>
                  </div>
                )}
              </Card>
            </div>

            {/* CRM Conversão + Ranking Secretários */}
            <div className="grid gap-6 lg:grid-cols-2">

              {/* CRM */}
              <Card title="Conversão CRM — Matrículas / Interessados" icon={<LuActivity className="h-4 w-4" />}>
                {loading ? <Skeleton /> : crmConv ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-center gap-8">
                      <ReactApexChart options={crmChart!.options as never} series={crmChart!.series} type="donut" height={200} width={200} />
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Total de leads</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white">{crmConv.totalLeads}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Taxa de conversão</p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{crmConv.conversionRate}%</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                      {[
                        { label: 'Matriculados', value: crmConv.matriculados,  color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
                        { label: 'Em andamento', value: crmConv.emAndamento,   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
                        { label: 'Perdidos',     value: crmConv.perdidos,      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
                      ].map(s => (
                        <div key={s.label} className={`rounded-lg px-3 py-2 text-center ${s.color}`}>
                          <p className="text-lg font-bold">{s.value}</p>
                          <p className="text-xs">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <p className="text-sm text-gray-400 text-center py-12">Sem dados de CRM</p>}
              </Card>

              {/* Ranking Secretários */}
              <Card title="Ranking de Secretários — Matrículas do Mês" icon={<LuAward className="h-4 w-4" />}>
                <div className="mb-3 flex items-center gap-2">
                  <select value={rankMonth} onChange={e => setRankMonth(Number(e.target.value))}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 focus:outline-none">
                    {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
                {loading ? <Skeleton /> : secretaryRank && secretaryRank.data.length > 0 ? (
                  <ol className="space-y-2">
                    {secretaryRank.data.map((s, i) => (
                      <li key={s.id} className="flex items-center gap-3">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold
                          ${i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                            : i === 1 ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            : 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400'}`}>
                          {i + 1}
                        </span>
                        <span className="flex-1 truncate text-sm text-gray-800 dark:text-gray-200">{s.full_name}</span>
                        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                          {s.enrollments} matrícula{s.enrollments !== 1 ? 's' : ''}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-sm text-gray-400">
                    <LuAward className="mb-2 h-8 w-8 opacity-30" />
                    Nenhuma matrícula encontrada neste período
                    <span className="mt-1 text-xs opacity-70">(requer campo "criado por" nas matrículas novas)</span>
                  </div>
                )}
              </Card>
            </div>

            {/* Cidades */}
            <Card title="Cidades com Mais Alunos" icon={<LuMapPin className="h-4 w-4" />} className="lg:col-span-2">
              {loading ? <Skeleton /> : citiesChart ? (
                <ReactApexChart options={citiesChart.options as never} series={citiesChart.series} type="bar" height={280} />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-sm text-gray-400">
                  <LuMapPin className="mb-2 h-8 w-8 opacity-30" />
                  Nenhuma cidade cadastrada
                  <span className="mt-1 text-xs opacity-70">(preencha o campo "cidade" nos cadastros de alunos)</span>
                </div>
              )}
            </Card>

            {/* Frequência dos Alunos */}
            <Card title="Frequência dos Alunos (ativos)" icon={<LuUsers className="h-4 w-4" />}>
              {loading ? <Skeleton /> : attendance.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">Nenhum registro de frequência encontrado</p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700">
                        <th className="pb-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Aluno</th>
                        <th className="pb-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Aulas</th>
                        <th className="pb-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Presentes</th>
                        <th className="pb-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-40">Frequência</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                      {[...attendance]
                        .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101))
                        .slice(0, 30)
                        .map(s => (
                          <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="py-2 pr-4 font-medium text-gray-800 dark:text-gray-200 max-w-[180px] truncate">{s.full_name}</td>
                            <td className="py-2 text-center text-gray-600 dark:text-gray-400">{s.total}</td>
                            <td className="py-2 text-center text-gray-600 dark:text-gray-400">{s.present}</td>
                            <td className="py-2">
                              {s.rate === null ? (
                                <span className="text-xs text-gray-400">—</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 rounded-full bg-gray-100 dark:bg-gray-700 h-2">
                                    <div className={`h-2 rounded-full ${barColor(s.rate)}`} style={{ width: `${s.rate}%` }} />
                                  </div>
                                  <span className={`text-xs font-medium w-9 text-right ${rateColor(s.rate)}`}>{s.rate}%</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {attendance.length > 30 && (
                    <p className="mt-3 text-center text-xs text-gray-400">Mostrando 30 de {attendance.length} alunos (ordenado por menor frequência)</p>
                  )}
                </div>
              )}
            </Card>

          </div>
        )}
      </div>
    </>
  )
}
