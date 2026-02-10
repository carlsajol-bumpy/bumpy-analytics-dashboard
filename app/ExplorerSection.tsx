'use client'
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, Cell, ReferenceLine
} from 'recharts'
import { exportToCSV } from '../lib/csvExport'

// ─────────────────────────────────────────────────────────────────────────────
// EXACT column names from creative_performance table:
//
// STATIC (no suffix):
//   id, ad_id, ad_name, adset_name, platform, status, concept_code, persona,
//   media_type, language, performance_category, trend, batch, budget,
//   peak_roas, peak_ctr, week_number, year
//
// PER-TIMEFRAME (swap suffix):
//   spend_7d       | spend_prev       | spend_28d       | spend_30d
//   roas_7d        | roas_prev        | roas_28d        | roas_30d      ← ROAS
//   ctr_7d         | ctr_prev         | ctr_28d         | ctr_30d
//   hook_rate_7d   | hook_rate_prev   | hook_rate_28d   | hook_rate_30d
//   hold_rate_7d   | hold_rate_prev   | hold_rate_28d   | hold_rate_30d
//   conversion_rate_7d | ...
//   impressions_7d | impressions_prev | impressions_28d | impressions_30d
//   clicks_7d      | clicks_prev      | clicks_28d      | clicks_30d
//   conversions_7d | conversions_prev | conversions_28d | conversions_30d
//   cpa_7d         | cpa_prev         | cpa_28d         | cpa_30d
//   cpc_7d         | cpc_prev         | cpc_28d         | cpc_30d
//   cvr_7d         | cvr_prev         | cvr_28d         | cvr_30d
//   itp_7d         | itp_prev         | itp_28d         | itp_30d
//   ipm_7d         | ipm_prev         | ipm_28d         | ipm_30d
//   pp10k_7d       | pp10k_prev       | pp10k_28d       | pp10k_30d
//   frequency_7d   | frequency_prev   | frequency_28d   | frequency_30d
// ─────────────────────────────────────────────────────────────────────────────

const TIMEFRAME_OPTIONS = [
  { value: '7d',  label: 'Last 7 Days',  suffix: '_7d'   },
  { value: '14d', label: 'Last 14 Days', suffix: '_prev' },
  { value: '28d', label: 'Last 28 Days', suffix: '_28d'  },
  { value: '30d', label: 'Last 30 Days', suffix: '_30d'  },
]

const PERFORMANCE_OPTIONS = [
  'All', 'Winning', 'Contender', 'Fatigued',
  'Not-spending', 'Not-performing', 'Paused', 'Paused-winner', 'Paused-fatigued',
]

function safeNum(value: any, decimals = 2): string {
  const n = parseFloat(value)
  return isNaN(n) ? (0).toFixed(decimals) : n.toFixed(decimals)
}

interface Props { isDark?: boolean }

export default function CreativePersonaReportView({ isDark }: Props) {
  const [rawData, setRawData]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'charts' | 'scatter'>('charts')

  const [filters, setFilters] = useState({
    timeframe:   '7d',
    performance: 'All',
    persona:     [] as string[],
    concept:     [] as string[],
    campaign:    'All',
    minSpend:    0,
  })

  const [scatterConfig, setScatterConfig] = useState({
    xAxis: 'spend', yAxis: 'roas', maxItems: 500, minSpendForScatter: 10,
  })

  // ── Active suffix ─────────────────────────────────────────────────
  const suffix = useMemo(
    () => TIMEFRAME_OPTIONS.find(t => t.value === filters.timeframe)?.suffix ?? '_7d',
    [filters.timeframe]
  )

  // col(base) → exact Supabase column name for the active timeframe
  // Special case: ROAS column is "roas_*" not "roas_*"
  const col = useCallback((base: string) => {
    const colBase = base === 'roas' ? 'roas' : base
    return `${colBase}${suffix}`
  }, [suffix])

  const n = useCallback((row: any, base: string): number => {
    return parseFloat(row[col(base)]) || 0
  }, [col])

  const availableMetrics = [
    { value: 'spend',       label: 'Spend ($)',   format: (v: number) => `$${v.toFixed(0)}` },
    { value: 'roas',        label: 'ROAS',        format: (v: number) => `${v.toFixed(2)}x`  },
    { value: 'conversions', label: 'Conversions', format: (v: number) => v.toFixed(0)         },
    { value: 'impressions', label: 'Impressions', format: (v: number) => v.toFixed(0)         },
    { value: 'clicks',      label: 'Clicks',      format: (v: number) => v.toFixed(0)         },
    { value: 'ctr',         label: 'CTR (%)',     format: (v: number) => `${(v * 100).toFixed(2)}%` },
    { value: 'cpa',         label: 'CPA ($)',     format: (v: number) => `$${v.toFixed(2)}`  },
    { value: 'cpc',         label: 'CPC ($)',     format: (v: number) => `$${v.toFixed(2)}`  },
    { value: 'frequency',   label: 'Frequency',   format: (v: number) => v.toFixed(2)         },
    { value: 'hook_rate',   label: 'Hook Rate',   format: (v: number) => `${(v * 100).toFixed(1)}%` },
    { value: 'hold_rate',   label: 'Hold Rate',   format: (v: number) => `${(v * 100).toFixed(1)}%` },
    { value: 'ipm',         label: 'IPM',         format: (v: number) => v.toFixed(2)         },
  ]

  // ── Fetch ALL rows (paginated) ────────────────────────────────────
  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const PAGE = 1000
      let allRows: any[] = []
      let from = 0

      while (true) {
        const { data: page, error } = await supabase
          .from('creative_performance')
          .select('*')
          .range(from, from + PAGE - 1)

        if (error) { console.error('Supabase error:', error); break }
        if (!page?.length) break
        allRows = allRows.concat(page)
        if (page.length < PAGE) break
        from += PAGE
      }

      if (!allRows.length) {
        console.warn('creative_performance returned 0 rows')
        setLoading(false)
        return
      }

      setRawData(allRows)
    } catch (err) {
      console.error('fetchData error:', err)
    }
    setLoading(false)
  }

  // ── timedData: remap per-timeframe columns to stable names ───────
  const timedData = useMemo(() =>
    rawData.map(row => ({
      ...row,
      // Computed fields using active timeframe columns
      spend:       n(row, 'spend'),
      roas:        n(row, 'roas'),        // reads roas_7d / roas_prev / etc
      conversions: n(row, 'conversions'),
      impressions: n(row, 'impressions'),
      clicks:      n(row, 'clicks'),
      ctr:         n(row, 'ctr'),
      cpa:         n(row, 'cpa'),
      cpc:         n(row, 'cpc'),
      frequency:   n(row, 'frequency'),
      hook_rate:   n(row, 'hook_rate'),
      hold_rate:   n(row, 'hold_rate'),
      ipm:         n(row, 'ipm'),
      // Static columns (already correct names from DB)
      // persona, concept_code, performance_category, batch, ad_name, adset_name, status are pass-through
    })),
  [rawData, suffix])  // re-runs when timeframe changes

  // ── Filters ───────────────────────────────────────────────────────
  const filteredData = useMemo(() => timedData.filter(row => {
    if (filters.performance !== 'All') {
      const norm = (s: string) => (s || '').toLowerCase().replace(/[\s_-]/g, '')
      if (norm(row.performance_category) !== norm(filters.performance)) return false
    }
    if (filters.persona.length > 0  && !filters.persona.includes(row.persona))        return false
    if (filters.concept.length > 0  && !filters.concept.includes(row.concept_code))   return false
    if (filters.campaign !== 'All'  && row.adset_name !== filters.campaign)             return false
    if (row.spend < filters.minSpend)                                                   return false
    return true
  }), [timedData, filters])

  // ── Dropdown options ──────────────────────────────────────────────
  const personaOptions  = useMemo(() => [...new Set(rawData.map(d => d.persona).filter(Boolean))].sort(),       [rawData])
  const conceptOptions  = useMemo(() => [...new Set(rawData.map(d => d.concept_code).filter(Boolean))].sort(),  [rawData])
  const campaignOptions = useMemo(() => ['All', ...new Set(rawData.map(d => d.adset_name).filter(Boolean))].sort(), [rawData])
  const filteredPersonas = useMemo(() => [...new Set(filteredData.map(d => d.persona).filter(Boolean))],        [filteredData])

  // ── Totals ────────────────────────────────────────────────────────
  const totals = useMemo(() => filteredData.reduce(
    (acc, row) => ({
      spend:       acc.spend       + row.spend,
      conversions: acc.conversions + row.conversions,
      impressions: acc.impressions + row.impressions,
      clicks:      acc.clicks      + row.clicks,
    }),
    { spend: 0, conversions: 0, impressions: 0, clicks: 0 }
  ), [filteredData])

  const totalSpendForRoas = totals.spend
  // Weighted avg ROAS = sum(spend * roas) / sum(spend)
  const weightedRoas = useMemo(() => {
    const weightedSum = filteredData.reduce((s, r) => s + r.spend * r.roas, 0)
    return totalSpendForRoas > 0 ? weightedSum / totalSpendForRoas : 0
  }, [filteredData, totalSpendForRoas])

  // ── Bar chart aggregation ─────────────────────────────────────────
  const personaAggregated = useMemo(() =>
    (Object.values(filteredData.reduce((acc: any, row) => {
      const p = row.persona || 'Unknown'
      if (!acc[p]) acc[p] = { persona: p, spend: 0, conversions: 0, roas_sum: 0, roas_n: 0 }
      acc[p].spend       += row.spend
      acc[p].conversions += row.conversions
      if (row.roas > 0) { acc[p].roas_sum += row.spend * row.roas; acc[p].roas_n += row.spend }
      return acc
    }, {})) as any[])
      .map(d => ({ ...d, roas: d.roas_n > 0 ? d.roas_sum / d.roas_n : 0 }))
      .sort((a, b) => b.spend - a.spend),
  [filteredData])

  // ── Weekly trend using batch column ──────────────────────────────
  const batchTrend = useMemo(() => {
    const acc: any = {}
    filteredData.forEach(row => {
      const bk = row.batch || 'Unknown'
      const p  = row.persona || 'Unknown'
      if (!acc[bk]) acc[bk] = { batch: bk, total_spend: 0 }
      const sk = `${p}_spend`
      if (!acc[bk][sk]) acc[bk][sk] = 0
      acc[bk][sk]          += row.spend || 0
      acc[bk].total_spend  += row.spend || 0
    })
    return (Object.values(acc) as any[]).sort((a, b) => a.batch.localeCompare(b.batch))
  }, [filteredData])

  // ── Scatter ───────────────────────────────────────────────────────
  const scatterFiltered = useMemo(() =>
    filteredData
      .filter(row => row.spend >= scatterConfig.minSpendForScatter)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, scatterConfig.maxItems),
  [filteredData, scatterConfig])

  const scatterData = useMemo(() =>
    scatterFiltered.map(row => ({
      ...row,
      x: row[scatterConfig.xAxis],
      y: row[scatterConfig.yAxis],
      label: (row.ad_name || '').substring(0, 40),
    })),
  [scatterFiltered, scatterConfig])

  const { xMedian, yMedian } = useMemo(() => {
    const xs = scatterData.map(d => d.x).filter(v => v > 0).sort((a, b) => a - b)
    const ys = scatterData.map(d => d.y).filter(v => v > 0).sort((a, b) => a - b)
    return { xMedian: xs[Math.floor(xs.length / 2)] ?? 0, yMedian: ys[Math.floor(ys.length / 2)] ?? 0 }
  }, [scatterData])

  const getQ = (x: number, y: number) => {
    if (x >= xMedian && y >= yMedian) return { color: '#10B981', qlabel: 'Winners' }
    if (x <  xMedian && y >= yMedian) return { color: '#F59E0B', qlabel: 'Hidden Gems' }
    if (x >= xMedian && y <  yMedian) return { color: '#EF4444', qlabel: 'Needs Attention' }
    return { color: '#6B7280', qlabel: 'Test/Low' }
  }

  const scatterDataQ = useMemo(() =>
    scatterData.map(d => ({ ...d, ...getQ(d.x, d.y) })),
  [scatterData, xMedian, yMedian])

  // ── Colors ────────────────────────────────────────────────────────
  const PALETTE = ['#3B82F6','#EF4444','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#F97316','#84CC16','#A78BFA']
  const personaColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    filteredPersonas.forEach((p, i) => { map[p] = PALETTE[i % PALETTE.length] })
    return map
  }, [filteredPersonas])

  // ── CSV ───────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    exportToCSV(filteredData, `creative_report_${filters.timeframe}`, [
      { key: 'ad_name',            label: 'Ad Name'           },
      { key: 'persona',            label: 'Persona'           },
      { key: 'concept_code',       label: 'Concept'           },
      { key: 'performance_category', label: 'Performance'     },
      { key: 'adset_name',         label: 'Ad Set'            },
      { key: 'batch',              label: 'Batch'             },
      { key: 'media_type',         label: 'Media Type'        },
      { key: 'language',           label: 'Language'          },
      { key: 'spend',              label: `Spend (${filters.timeframe})` },
      { key: 'roas',               label: 'ROAS'              },
      { key: 'conversions',        label: 'Conversions'       },
      { key: 'cpa',                label: 'CPA ($)'           },
      { key: 'impressions',        label: 'Impressions'       },
      { key: 'clicks',             label: 'Clicks'            },
      { key: 'ctr',                label: 'CTR'               },
      { key: 'hook_rate',          label: 'Hook Rate'         },
      { key: 'hold_rate',          label: 'Hold Rate'         },
      { key: 'frequency',          label: 'Frequency'         },
    ])
  }

  // ── Helpers ───────────────────────────────────────────────────────
  const sel = `w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`
  const lbl = `block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`
  const tfLabel = TIMEFRAME_OPTIONS.find(t => t.value === filters.timeframe)?.label ?? ''

  const clearFilters = () => setFilters({
    timeframe: '7d', performance: 'All',
    persona: [], concept: [], campaign: 'All', minSpend: 0,
  })

  const perfBadge = (p: string) => {
    const n = (p || '').toLowerCase().replace(/[\s_-]/g, '')
    if (n.includes('win'))        return 'bg-green-900/30 text-green-400'
    if (n.includes('contend'))    return 'bg-yellow-900/30 text-yellow-400'
    if (n.includes('fatigue'))    return 'bg-orange-900/30 text-orange-400'
    if (n.includes('pause'))      return 'bg-gray-600/50 text-gray-300'
    if (n.includes('notspend'))   return 'bg-blue-900/30 text-blue-400'
    if (n.includes('notperform')) return 'bg-red-900/30 text-red-400'
    return isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600'
  }

  // ── Scatter tooltip ───────────────────────────────────────────────
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d  = payload[0].payload
    const xM = availableMetrics.find(m => m.value === scatterConfig.xAxis)
    const yM = availableMetrics.find(m => m.value === scatterConfig.yAxis)
    return (
      <div className={`rounded-lg p-3 shadow-lg border text-xs max-w-[220px] ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className={`font-semibold mb-2 truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{d.label}</div>
        {[
          ['Persona',   d.persona],
          ['Concept',   d.concept_code],
          [xM?.label,   xM?.format(d.x)],
          [yM?.label,   yM?.format(d.y)],
          ['Quadrant',  d.qlabel],
        ].map(([k, v], i) => (
          <div key={i} className="flex justify-between gap-3">
            <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{k}:</span>
            <span className="font-medium" style={k === 'Quadrant' ? { color: d.color } : {}}>{v as string}</span>
          </div>
        ))}
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) return (
    <div className={`rounded-xl p-12 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
        <span className={`ml-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Loading creatives…</span>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Creative Performance</h2>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          <span className="font-medium">{rawData.length.toLocaleString()}</span> creatives — reading{' '}
          <code className={`text-xs px-1.5 py-0.5 rounded font-mono ${isDark ? 'bg-gray-700 text-cyan-400' : 'bg-gray-100 text-cyan-600'}`}>
            *{suffix}
          </code>{' '}
          columns — <span className="font-medium text-cyan-500">{tfLabel}</span>
        </p>
      </div>

      {/* ── Filters ────────────────────────────────────────────────── */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-base font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Filters</h3>

        {/* Row 1 */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          <div>
            <label className={lbl}>Timeframe</label>
            <select value={filters.timeframe}
              onChange={e => setFilters({ ...filters, timeframe: e.target.value })} className={sel}>
              {TIMEFRAME_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Performance</label>
            <select value={filters.performance}
              onChange={e => setFilters({ ...filters, performance: e.target.value })} className={sel}>
              {PERFORMANCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Ad Set</label>
            <select value={filters.campaign}
              onChange={e => setFilters({ ...filters, campaign: e.target.value })} className={sel}>
              {campaignOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Min Spend ({filters.timeframe})</label>
            <input type="number" value={filters.minSpend} placeholder="0"
              onChange={e => setFilters({ ...filters, minSpend: parseFloat(e.target.value) || 0 })}
              className={sel} />
          </div>
          <div className="flex items-end">
            <button onClick={clearFilters}
              className={`w-full px-4 py-2 text-sm rounded-lg ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              Clear Filters
            </button>
          </div>
        </div>

        {/* Row 2 — multi-selects */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className={lbl}>
              Persona {filters.persona.length > 0 && <span className="text-cyan-500">({filters.persona.length} selected)</span>}
            </label>
            <select multiple size={5} value={filters.persona}
              onChange={e => setFilters({ ...filters, persona: Array.from(e.target.selectedOptions, o => o.value) })}
              className={sel}>
              {personaOptions.map(p => (
                <option key={p} value={p} className={filters.persona.includes(p) ? 'bg-cyan-600 text-white' : ''}>{p}</option>
              ))}
            </select>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Hold Ctrl/Cmd to multi-select</p>
          </div>
          <div>
            <label className={lbl}>
              Concept {filters.concept.length > 0 && <span className="text-cyan-500">({filters.concept.length} selected)</span>}
            </label>
            <select multiple size={5} value={filters.concept}
              onChange={e => setFilters({ ...filters, concept: Array.from(e.target.selectedOptions, o => o.value) })}
              className={sel}>
              {conceptOptions.map(c => (
                <option key={c} value={c} className={filters.concept.includes(c) ? 'bg-cyan-600 text-white' : ''}>{c}</option>
              ))}
            </select>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Hold Ctrl/Cmd to multi-select</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Showing{' '}
            <span className="font-semibold text-cyan-500">{filteredData.length.toLocaleString()}</span>
            {' '}of{' '}
            <span className="font-semibold">{rawData.length.toLocaleString()}</span> creatives
            <span className={`ml-2 text-xs px-2 py-0.5 rounded ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              {tfLabel}
            </span>
            {filters.performance !== 'All' && (
              <span className="ml-1 text-xs px-2 py-0.5 rounded bg-cyan-900/30 text-cyan-400">{filters.performance}</span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportCSV}
              className="px-4 py-2 text-sm rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            {(['scatter','charts','table'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  viewMode === mode
                    ? 'bg-cyan-600 text-white'
                    : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}>
                {mode === 'scatter' ? 'Scatter Plot' : mode === 'charts' ? 'Charts' : 'Table'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Summary Stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: `Spend (${filters.timeframe})`, value: `$${safeNum(totals.spend / 1000, 1)}K` },
          { label: 'Weighted ROAS', value: `${safeNum(weightedRoas, 2)}x`,
            color: weightedRoas >= 2 ? 'text-green-600' : weightedRoas >= 1 ? 'text-yellow-600' : 'text-red-600' },
          { label: `Conversions (${filters.timeframe})`, value: Math.round(totals.conversions).toLocaleString() },
          { label: 'Impressions',   value: (Math.round(totals.impressions / 1000)).toLocaleString() + 'K' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{label}</div>
            <div className={`text-2xl font-bold ${color ?? (isDark ? 'text-white' : 'text-gray-900')}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* ══════════ SCATTER VIEW ══════════════════════════════════════ */}
      {viewMode === 'scatter' && (
        <div className="space-y-6">
          <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-base font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Quadrant Configuration</h3>

            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`text-xs self-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Presets:</span>
              {[
                { label: 'Spend vs ROAS',       cfg: { xAxis: 'spend', yAxis: 'roas',      minSpendForScatter: 50,  maxItems: 500 } },
                { label: 'Spend vs Conv',        cfg: { xAxis: 'spend', yAxis: 'conversions', minSpendForScatter: 100, maxItems: 250 } },
                { label: 'Hook vs Hold Rate',    cfg: { xAxis: 'hook_rate', yAxis: 'hold_rate', minSpendForScatter: 20, maxItems: 500 } },
                { label: 'Impressions vs ROAS',  cfg: { xAxis: 'impressions', yAxis: 'roas', minSpendForScatter: 10, maxItems: 1000 } },
              ].map(({ label, cfg }) => (
                <button key={label} onClick={() => setScatterConfig(p => ({ ...p, ...cfg }))}
                  className={`px-3 py-1 text-xs rounded ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <label className={lbl}>X-Axis</label>
                <select value={scatterConfig.xAxis} onChange={e => setScatterConfig({ ...scatterConfig, xAxis: e.target.value })} className={sel}>
                  {availableMetrics.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Y-Axis</label>
                <select value={scatterConfig.yAxis} onChange={e => setScatterConfig({ ...scatterConfig, yAxis: e.target.value })} className={sel}>
                  {availableMetrics.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Min Spend ($)</label>
                <input type="number" value={scatterConfig.minSpendForScatter} placeholder="10"
                  onChange={e => setScatterConfig({ ...scatterConfig, minSpendForScatter: parseFloat(e.target.value) || 0 })}
                  className={sel} />
              </div>
              <div>
                <label className={lbl}>Max Items</label>
                <select value={scatterConfig.maxItems} onChange={e => setScatterConfig({ ...scatterConfig, maxItems: parseInt(e.target.value) })} className={sel}>
                  {[100,250,500,1000,2000].map(n => <option key={n} value={n}>{n} creatives</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Winners',         sub: 'High X, High Y', color: '#10B981', bg: isDark ? 'bg-green-900/20'  : 'bg-green-50',  text: isDark ? 'text-green-400'  : 'text-green-700'  },
                { label: 'Hidden Gems',     sub: 'Low X, High Y',  color: '#F59E0B', bg: isDark ? 'bg-orange-900/20' : 'bg-orange-50', text: isDark ? 'text-orange-400' : 'text-orange-700' },
                { label: 'Needs Attention', sub: 'High X, Low Y',  color: '#EF4444', bg: isDark ? 'bg-red-900/20'   : 'bg-red-50',    text: isDark ? 'text-red-400'    : 'text-red-700'    },
                { label: 'Test/Low',        sub: 'Low X, Low Y',   color: '#6B7280', bg: isDark ? 'bg-gray-900/20'  : 'bg-gray-50',   text: isDark ? 'text-gray-400'   : 'text-gray-700'   },
              ].map(q => (
                <div key={q.label} className={`flex items-center gap-2 p-3 rounded-lg ${q.bg}`}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: q.color }} />
                  <div>
                    <div className={`text-xs font-semibold ${q.text}`}>{q.label}</div>
                    <div className={`text-xs ${q.text} opacity-75`}>{q.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {availableMetrics.find(m => m.value === scatterConfig.xAxis)?.label} vs {availableMetrics.find(m => m.value === scatterConfig.yAxis)?.label}
            </h3>
            <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {scatterData.length.toLocaleString()} of {filteredData.length.toLocaleString()} creatives — {tfLabel}
            </p>
            <ResponsiveContainer width="100%" height={520}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                <XAxis type="number" dataKey="x" stroke={isDark ? '#9CA3AF' : '#6B7280'} tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="y" stroke={isDark ? '#9CA3AF' : '#6B7280'} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x={xMedian} stroke={isDark ? '#6B7280' : '#9CA3AF'} strokeDasharray="4 3" strokeWidth={1.5}
                  label={{ value: 'Median', fill: isDark ? '#9CA3AF' : '#6B7280', fontSize: 11 }} />
                <ReferenceLine y={yMedian} stroke={isDark ? '#6B7280' : '#9CA3AF'} strokeDasharray="4 3" strokeWidth={1.5}
                  label={{ value: 'Median', fill: isDark ? '#9CA3AF' : '#6B7280', fontSize: 11 }} />
                <Scatter data={scatterDataQ}>
                  {scatterDataQ.map((entry, i) => <Cell key={`c-${i}`} fill={entry.color} fillOpacity={0.8} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>

            <div className="mt-4 grid grid-cols-4 gap-4">
              {[
                { label: 'Winners',         color: '#10B981', fn: (d: any) => d.x >= xMedian && d.y >= yMedian },
                { label: 'Hidden Gems',     color: '#F59E0B', fn: (d: any) => d.x <  xMedian && d.y >= yMedian },
                { label: 'Needs Attention', color: '#EF4444', fn: (d: any) => d.x >= xMedian && d.y <  yMedian },
                { label: 'Test/Low',        color: '#6B7280', fn: (d: any) => d.x <  xMedian && d.y <  yMedian },
              ].map(q => {
                const items = scatterDataQ.filter(q.fn)
                const spend = items.reduce((s, c) => s + c.spend, 0)
                const wRoas = items.reduce((s, c) => s + c.spend * c.roas, 0)
                return (
                  <div key={q.label} className={`rounded-lg p-4 border ${isDark ? 'border-gray-600 bg-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: q.color }} />
                      <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{q.label}</span>
                    </div>
                    <div className={`text-xs space-y-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      <div>{items.length} creatives</div>
                      <div>${safeNum(spend, 0)} spent</div>
                      <div>Avg ROAS: {safeNum(spend > 0 ? wRoas / spend : 0, 2)}x</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ CHARTS VIEW ═══════════════════════════════════════ */}
      {viewMode === 'charts' && (
        <div className="space-y-6">
          <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Spend &amp; ROAS by Persona
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {tfLabel} — sorted by spend — {personaAggregated.length} personas
                </p>
              </div>
            </div>

            {/* Custom tooltip — looks up persona in aggregated data to show both metrics */}
            {(() => {
              const personaMap = Object.fromEntries(personaAggregated.map(p => [p.persona, p]))
              const tooltipStyle = {
                backgroundColor: isDark ? '#1F2937' : '#fff',
                border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                borderRadius: 8,
                fontSize: 12,
                color: isDark ? '#F9FAFB' : '#111827',
              }
              const SpendTooltip = ({ active, payload }: any) => {
                if (!active || !payload?.length) return null
                const persona = payload[0]?.payload?.persona
                const d = personaMap[persona]
                if (!d) return null
                return (
                  <div style={tooltipStyle} className="p-3 shadow-lg">
                    <div className="font-semibold mb-1.5">{persona}</div>
                    <div className="flex justify-between gap-6">
                      <span style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Spend</span>
                      <span className="font-medium">${d.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>ROAS</span>
                      <span className={`font-medium ${d.roas >= 2 ? 'text-green-500' : d.roas >= 1 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {d.roas.toFixed(2)}x
                      </span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Conversions</span>
                      <span className="font-medium">{Math.round(d.conversions)}</span>
                    </div>
                  </div>
                )
              }
              const RoasTooltip = ({ active, payload }: any) => {
                if (!active || !payload?.length) return null
                const persona = payload[0]?.payload?.persona
                const d = personaMap[persona]
                if (!d) return null
                return (
                  <div style={tooltipStyle} className="p-3 shadow-lg">
                    <div className="font-semibold mb-1.5">{persona}</div>
                    <div className="flex justify-between gap-6">
                      <span style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>ROAS</span>
                      <span className={`font-medium ${d.roas >= 2 ? 'text-green-500' : d.roas >= 1 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {d.roas.toFixed(2)}x
                      </span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Spend</span>
                      <span className="font-medium">${d.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Conversions</span>
                      <span className="font-medium">{Math.round(d.conversions)}</span>
                    </div>
                  </div>
                )
              }

              const yAxisColor = isDark ? '#E5E7EB' : '#111827'
              const xAxisColor = isDark ? '#9CA3AF' : '#6B7280'
              const gridColor  = isDark ? '#374151' : '#E5E7EB'
              const sectionLabelClass = `text-xs font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`

              return (
                <div className="grid grid-cols-2 gap-6">
                  {/* Left: Spend sorted by spend desc */}
                  <div>
                    <div className={sectionLabelClass}>Spend ($)</div>
                    <ResponsiveContainer width="100%" height={Math.max(320, personaAggregated.length * 26)}>
                      <BarChart layout="vertical" data={personaAggregated}
                        margin={{ top: 0, right: 16, bottom: 0, left: 8 }} barSize={14}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis type="number" stroke={xAxisColor} tick={{ fontSize: 10, fill: xAxisColor }}
                          tickFormatter={(v) => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`} />
                        <YAxis type="category" dataKey="persona" width={115}
                          tick={{ fontSize: 11, fill: yAxisColor }} stroke="none" />
                        <Tooltip content={<SpendTooltip />}
                          cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }} />
                        <Bar dataKey="spend" radius={[0, 4, 4, 0]}>
                          {personaAggregated.map((_, i) => (
                            <Cell key={`s-${i}`} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Right: ROAS sorted by roas desc */}
                  <div>
                    <div className={sectionLabelClass}>ROAS</div>
                    <ResponsiveContainer width="100%" height={Math.max(320, personaAggregated.length * 26)}>
                      <BarChart layout="vertical"
                        data={[...personaAggregated].sort((a, b) => b.roas - a.roas)}
                        margin={{ top: 0, right: 16, bottom: 0, left: 8 }} barSize={14}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis type="number" stroke={xAxisColor} tick={{ fontSize: 10, fill: xAxisColor }}
                          tickFormatter={(v) => `${v.toFixed(1)}x`} />
                        <YAxis type="category" dataKey="persona" width={115}
                          tick={{ fontSize: 11, fill: yAxisColor }} stroke="none" />
                        <Tooltip content={<RoasTooltip />}
                          cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }} />
                        <ReferenceLine x={1} stroke="#EF4444" strokeDasharray="4 2" strokeWidth={1.5} />
                        <Bar dataKey="roas" radius={[0, 4, 4, 0]}>
                          {[...personaAggregated].sort((a, b) => b.roas - a.roas).map((entry, i) => (
                            <Cell key={`r-${i}`}
                              fill={entry.roas >= 2 ? '#10B981' : entry.roas >= 1 ? '#F59E0B' : '#EF4444'}
                              fillOpacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })()}

            {/* Legend */}
            <div className={`mt-4 flex items-center gap-4 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-green-500" /> ROAS ≥ 2x</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-yellow-500" /> ROAS 1–2x</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> ROAS &lt; 1x</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-dashed border-red-500 mt-0.5" /> Break-even</span>
            </div>
          </div>

          <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Spend by Persona &amp; Batch</h3>
            <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Top 5 personas — grouped by batch</p>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={batchTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                <XAxis dataKey="batch" stroke={isDark ? '#9CA3AF' : '#6B7280'} tick={{ fontSize: 10 }} />
                <YAxis stroke={isDark ? '#9CA3AF' : '#6B7280'} label={{ value: 'Spend ($)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1F2937' : '#fff', border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`, borderRadius: 8 }} />
                <Legend wrapperStyle={{ paddingTop: 16 }} />
                {filteredPersonas.slice(0, 5).map((persona, i) => (
                  <Bar key={persona} dataKey={`${persona}_spend`}
                    fill={personaColorMap[persona] || PALETTE[i % PALETTE.length]}
                    name={`${persona} Spend`} stackId="a" />
                ))}
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' }}>
              {filteredPersonas.slice(0, 5).map(persona => {
                const rows  = filteredData.filter(d => d.persona === persona)
                const spend = rows.reduce((s, d) => s + d.spend, 0)
                const wR    = rows.reduce((s, d) => s + d.spend * d.roas, 0)
                const roas  = spend > 0 ? wR / spend : 0
                return (
                  <div key={persona} className={`p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className={`text-xs font-medium truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{persona}</div>
                    <div className={`text-sm font-bold ${roas >= 1 ? 'text-green-600' : 'text-red-600'}`}>{safeNum(roas, 2)}x</div>
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>${safeNum(spend / 1000, 1)}K</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ TABLE VIEW ════════════════════════════════════════ */}
      {viewMode === 'table' && (
        <div className={`rounded-xl overflow-hidden shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="p-5 border-b border-gray-700">
            <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Detailed Data</h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {filteredData.length.toLocaleString()} rows — {tfLabel}
              {filters.performance !== 'All' && ` — ${filters.performance}`}
            </p>
          </div>
          <div className="overflow-x-auto max-h-[640px]">
            <table className="w-full text-xs">
              <thead className={`sticky top-0 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <tr>
                  {[
                    'Ad Name','Persona','Concept','Performance','Batch','Type',
                    'Spend','ROAS','Conv','CPA','Impr','Clicks','CTR','Hook%','Hold%','Freq',
                  ].map(col => (
                    <th key={col} className={`px-3 py-3 text-xs font-medium uppercase tracking-wider whitespace-nowrap
                      ${['Spend','ROAS','Conv','CPA','Impr','Clicks','CTR','Hook%','Hold%','Freq'].includes(col) ? 'text-right' : 'text-left'}
                      ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {filteredData.map((row, idx) => (
                  <tr key={idx} className={isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}>
                    <td className={`px-3 py-2 max-w-[200px] truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`} title={row.ad_name}>{row.ad_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>
                        {row.persona}
                      </span>
                    </td>
                    <td className={`px-3 py-2 max-w-[120px] truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{row.concept_code}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.performance_category && (
                        <span className={`px-2 py-0.5 rounded-full text-xs ${perfBadge(row.performance_category)}`}>
                          {row.performance_category}
                        </span>
                      )}
                    </td>
                    <td className={`px-3 py-2 whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{row.batch}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{row.media_type}</td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>${safeNum(row.spend, 2)}</td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap font-semibold ${row.roas >= 2 ? 'text-green-600' : row.roas >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {safeNum(row.roas, 2)}x
                    </td>
                    <td className={`px-3 py-2 text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{Math.round(row.conversions)}</td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>${safeNum(row.cpa, 2)}</td>
                    <td className={`px-3 py-2 text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{Math.round(row.impressions).toLocaleString()}</td>
                    <td className={`px-3 py-2 text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{Math.round(row.clicks).toLocaleString()}</td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{safeNum(row.ctr * 100, 2)}%</td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{safeNum(row.hook_rate * 100, 1)}%</td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{safeNum(row.hold_rate * 100, 1)}%</td>
                    <td className={`px-3 py-2 text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{safeNum(row.frequency, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}