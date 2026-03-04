'use client'
import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { exportToCSV } from '../lib/csvExport'

function safeNumber(value: any, decimals: number = 2): string {
  if (value === undefined || value === null || value === '') {
    return (0).toFixed(decimals)
  }
  const num = parseFloat(value)
  if (isNaN(num)) {
    return (0).toFixed(decimals)
  }
  return num.toFixed(decimals)
}

// Format week from "2025-11-08 - 2025-11-14" to "25-11-08 - 25-11-14"
function formatWeekShort(weekString: string): string {
  if (!weekString) return 'Unknown'
  
  // Match pattern: YYYY-MM-DD - YYYY-MM-DD
  const match = weekString.match(/(\d{4})-(\d{2})-(\d{2})\s*-\s*(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const [_, year1, month1, day1, year2, month2, day2] = match
    const shortYear1 = year1.slice(2) // "2025" -> "25"
    const shortYear2 = year2.slice(2)
    return `${shortYear1}-${month1}-${day1} - ${shortYear2}-${month2}-${day2}`
  }
  
  return weekString
}

interface CreativePersonaReportViewProps {
  isDark?: boolean
}

// Sort direction type
type SortDirection = 'asc' | 'desc' | null

// Column definition for sorting
interface SortableColumn {
  key: string
  label: string
  align: 'left' | 'right'
  type: 'string' | 'number'
}

export default function CreativePersonaReportView({ isDark }: CreativePersonaReportViewProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    persona: [] as string[],
    concept: [] as string[],
    campaign: 'All',
    minSpend: 0
  })

  // Sorting state
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  // Define sortable columns
  const sortableColumns: SortableColumn[] = [
    { key: 'week', label: 'Week', align: 'left', type: 'string' },
    { key: 'campaign_name', label: 'Campaign', align: 'left', type: 'string' },
    { key: 'ad_name', label: 'Ad Name', align: 'left', type: 'string' },
    { key: 'persona', label: 'Persona', align: 'left', type: 'string' },
    { key: 'concept_code', label: 'Concept', align: 'left', type: 'string' },
    { key: 'spend', label: 'Spend', align: 'right', type: 'number' },
    { key: 'revenue', label: 'Revenue', align: 'right', type: 'number' },
    { key: 'roas', label: 'ROAS', align: 'right', type: 'number' },
    { key: 'purchases', label: 'Purchases', align: 'right', type: 'number' },
    { key: 'cost_per_purchase', label: 'CPP', align: 'right', type: 'number' },
    { key: 'impressions', label: 'Impressions', align: 'right', type: 'number' },
    { key: 'link_clicks', label: 'Link Clicks', align: 'right', type: 'number' },
    { key: 'ctr', label: 'CTR', align: 'right', type: 'number' },
    { key: 'cpm', label: 'CPM', align: 'right', type: 'number' },
    { key: 'cpc', label: 'CPC', align: 'right', type: 'number' },
    { key: 'frequency', label: 'Frequency', align: 'right', type: 'number' },
  ]

  // Handle column header click for sorting
  const handleSort = (columnKey: string) => {
    if (sortField === columnKey) {
      // Cycle: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortField(null)
        setSortDirection(null)
      }
    } else {
      setSortField(columnKey)
      setSortDirection('asc')
    }
  }

  // Sort indicator component
  const SortIndicator = ({ columnKey }: { columnKey: string }) => {
    const isActive = sortField === columnKey
    return (
      <span className="inline-flex flex-col ml-1" style={{ lineHeight: 0, verticalAlign: 'middle' }}>
        <svg
          width="8" height="6" viewBox="0 0 8 6"
          className={`${isActive && sortDirection === 'asc' ? 'text-cyan-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}
          style={{ marginBottom: '1px' }}
        >
          <path d="M4 0L8 6H0L4 0Z" fill="currentColor" />
        </svg>
        <svg
          width="8" height="6" viewBox="0 0 8 6"
          className={`${isActive && sortDirection === 'desc' ? 'text-cyan-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}
          style={{ marginTop: '1px' }}
        >
          <path d="M4 6L0 0H8L4 6Z" fill="currentColor" />
        </svg>
      </span>
    )
  }

  // CSV Export Function
  const handleExportCSV = () => {
    const personaLabel = filters.persona.length > 0 ? filters.persona.join('_') : 'all'
    const conceptLabel = filters.concept.length > 0 ? filters.concept.join('_') : 'all'
    const filename = `persona_report_${personaLabel}_${conceptLabel}`
    
    exportToCSV(
      filteredData,
      filename,
      [
        { key: 'week', label: 'Week' },
        { key: 'campaign_name', label: 'Campaign' },
        { key: 'ad_name', label: 'Ad Name' },
        { key: 'persona', label: 'Persona' },
        { key: 'concept_code', label: 'Concept' },
        { key: 'spend', label: 'Spend ($)' },
        { key: 'revenue', label: 'Revenue ($)' },
        { key: 'roas', label: 'ROAS' },
        { key: 'purchases', label: 'Purchases' },
        { key: 'cost_per_purchase', label: 'CPP ($)' },
        { key: 'impressions', label: 'Impressions' },
        { key: 'link_clicks', label: 'Link Clicks' },
        { key: 'ctr', label: 'CTR' },
        { key: 'cpm', label: 'CPM ($)' },
        { key: 'frequency', label: 'Frequency' }
      ]
    )
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Extract persona from AD NAME - position 3 (SAME as By Concept tab)
  const extractPersona = (adName: string): string => {
    if (!adName) return 'Unknown'
    const parts = adName.split('-')
    return parts[3] || 'Unknown'
  }

  // Extract concept from AD NAME - position 2 (SAME as By Concept tab)
  const extractConceptCode = (adName: string): string => {
    if (!adName) return 'Unknown'
    const parts = adName.split('-')
    return parts[2] || 'Unknown'
  }

  async function fetchData() {
    setLoading(true)
    
    try {
      const { data: reportData, error } = await supabase
        .from('creative_persona_report')
        .select('*')
        .order('Week', { ascending: false })

      if (error) {
        console.error('Error fetching creative persona report:', error)
        setLoading(false)
        return
      }

      if (!reportData || reportData.length === 0) {
        console.warn('No data found in creative_persona_report')
        setLoading(false)
        return
      }

      // Enrich data with extracted persona, concept, and computed fields
      const enrichedData = reportData.map((row: any) => {
        const campaignName = row['Campaign name'] || ''
        const adName = row['Ad name'] || ''
        const amountSpent = parseFloat(row['Amount spent (USD)'] || 0)
        const revenue = parseFloat(row['Purchases conversion value'] || 0)
        const purchases = parseInt(row['Purchases'] || 0)
        const impressions = parseInt(row['Impressions'] || 0)
        const linkClicks = parseInt(row['Link clicks'] || 0)
        
        const weekValue = row['Week'] || row['week'] || row['WEEK'] || ''
        const personaValue = row['Persona'] || row['persona'] || row['PERSONA'] || extractPersona(adName) || 'Unknown'
        const conceptValue = row['Concept'] || row['concept'] || row['CONCEPT'] || extractConceptCode(adName) || 'Unknown'
        
        return {
          ...row,
          week: weekValue,
          week_raw: weekValue,
          persona: personaValue,
          concept_code: conceptValue,
          campaign_name: campaignName,
          ad_name: adName,
          spend: amountSpent,
          revenue: revenue,
          roas: row['Purchase ROAS (return on ad spend)'] || (amountSpent > 0 ? revenue / amountSpent : 0),
          purchases: purchases,
          impressions: impressions,
          link_clicks: linkClicks,
          cpm: row['CPM (cost per 1,000 impressions)'] || (impressions > 0 ? (amountSpent / impressions) * 1000 : 0),
          ctr: row['CTR (link click-through rate)'] || (impressions > 0 ? linkClicks / impressions : 0),
          frequency: row['Frequency'] || 0,
          cost_per_purchase: row['Cost per purchase'] || (purchases > 0 ? amountSpent / purchases : 0),
          // Pre-compute CPC for sorting
          cpc: linkClicks > 0 ? amountSpent / linkClicks : 0
        }
      })

      setData(enrichedData)
    } catch (err) {
      console.error('Error:', err)
    }
    
    setLoading(false)
  }

  // Apply filters
  const filteredData = data.filter(row => {
    if (filters.persona.length > 0 && !filters.persona.includes(row.persona)) {
      return false
    }
    if (filters.concept.length > 0 && !filters.concept.includes(row.concept_code)) {
      return false
    }
    if (filters.campaign !== 'All' && row.campaign_name !== filters.campaign) {
      return false
    }
    if (row.spend < filters.minSpend) {
      return false
    }
    return true
  })

  // Apply sorting to filtered data
  const sortedData = useMemo(() => {
    if (!sortField || !sortDirection) return filteredData

    const columnDef = sortableColumns.find(c => c.key === sortField)
    if (!columnDef) return filteredData

    return [...filteredData].sort((a, b) => {
      let valA = a[sortField]
      let valB = b[sortField]

      // Handle null/undefined
      if (valA === null || valA === undefined) valA = columnDef.type === 'number' ? 0 : ''
      if (valB === null || valB === undefined) valB = columnDef.type === 'number' ? 0 : ''

      if (columnDef.type === 'number') {
        valA = parseFloat(valA) || 0
        valB = parseFloat(valB) || 0
        return sortDirection === 'asc' ? valA - valB : valB - valA
      } else {
        valA = String(valA).toLowerCase()
        valB = String(valB).toLowerCase()
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1
        return 0
      }
    })
  }, [filteredData, sortField, sortDirection])

  // Get unique values for filters
  const personaOptions = ['All', ...new Set(data.map(d => d.persona).filter(Boolean))].sort()
  const conceptOptions = ['All', ...new Set(data.map(d => d.concept_code).filter(Boolean))].sort()
  const campaignOptions = ['All', ...new Set(data.map(d => d.campaign_name).filter(Boolean))].sort()

  // Aggregate by persona for bar chart
  const personaAggregated = Object.entries(
    filteredData.reduce((acc: any, row) => {
      const persona = row.persona || 'Unknown'
      if (!acc[persona]) {
        acc[persona] = { persona, spend: 0, revenue: 0, purchases: 0, impressions: 0 }
      }
      acc[persona].spend += row.spend || 0
      acc[persona].revenue += row.revenue || 0
      acc[persona].purchases += row.purchases || 0
      acc[persona].impressions += row.impressions || 0
      return acc
    }, {})
  ).map(([persona, data]: [string, any]) => ({
    ...data,
    roas: data.spend > 0 ? data.revenue / data.spend : 0
  })).sort((a, b) => b.spend - a.spend)

  // Weekly trend by persona
  const weeklyTrendRaw = Object.entries(
    filteredData.reduce((acc: any, row) => {
      const week = row.week || 'Unknown'
      const persona = row.persona || 'Unknown'
      
      if (!acc[week]) {
        acc[week] = { week, total_revenue: 0 }
      }
      
      const spendKey = `${persona}_spend`
      
      if (!acc[week][spendKey]) {
        acc[week][spendKey] = 0
        acc[week][`${persona}_roas`] = 0
        acc[week][`${persona}_revenue`] = 0
      }
      
      acc[week][spendKey] += row.spend || 0
      acc[week][`${persona}_revenue`] += row.revenue || 0
      acc[week].total_revenue += row.revenue || 0
      
      return acc
    }, {})
  )
  
  const filteredPersonas = [...new Set(filteredData.map(d => d.persona).filter(Boolean))]
  
  const weeklyTrend = weeklyTrendRaw.map(([week, data]: [string, any]) => {
    const result: any = { week, total_revenue: data.total_revenue }
    filteredPersonas.forEach(persona => {
      const spendKey = `${persona}_spend`
      const revenueKey = `${persona}_revenue`
      result[spendKey] = data[spendKey] || 0
      result[`${persona}_roas`] = data[spendKey] > 0 ? (data[revenueKey] || 0) / data[spendKey] : 0
    })
    return result
  }).sort((a, b) => a.week.localeCompare(b.week))

  // Calculate totals
  const totals = filteredData.reduce((acc, row) => {
    acc.spend += row.spend || 0
    acc.revenue += row.revenue || 0
    acc.purchases += row.purchases || 0
    acc.impressions += row.impressions || 0
    return acc
  }, { spend: 0, revenue: 0, purchases: 0, impressions: 0 })

  const overallRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0

  // Define colors for personas
  const personaColors: Record<string, string> = {
    'Passportbro': '#3B82F6',
    'PassportBro': '#3B82F6',
    'PassportGirl': '#EF4444',
    '30Female': '#EC4899',
    '30Male': '#3B82F6',
    '40Female': '#F97316',
    '40Male': '#8B5CF6',
    'BLK': '#8B5CF6',
    '6figures': '#10B981',
    'AsianMaleSouthEastAsianFemale': '#F59E0B',
    'Unknown': '#6B7280'
  }

  if (loading) {
    return (
      <div className={`rounded-xl p-12 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          <span className={`ml-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Loading persona report...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Creative Persona Report
        </h2>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Analyze performance by persona and week
        </p>
      </div>

      {/* Filters */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Filters</h3>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Persona {filters.persona.length > 0 && <span className="text-cyan-600">({filters.persona.length} selected)</span>}
            </label>
            <select 
              multiple 
              value={filters.persona} 
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value)
                setFilters({...filters, persona: selected})
              }}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              size={5}
            >
              {personaOptions.filter(p => p !== 'All').map(p => (
                <option key={p} value={p} className={filters.persona.includes(p) ? 'bg-cyan-600 text-white' : ''}>
                  {p}
                </option>
              ))}
            </select>
            <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              Hold Ctrl/Cmd to select multiple
            </div>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Concept {filters.concept.length > 0 && <span className="text-cyan-600">({filters.concept.length} selected)</span>}
            </label>
            <select 
              multiple 
              value={filters.concept} 
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value)
                setFilters({...filters, concept: selected})
              }}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              size={5}
            >
              {conceptOptions.filter(c => c !== 'All').map(c => (
                <option key={c} value={c} className={filters.concept.includes(c) ? 'bg-cyan-600 text-white' : ''}>
                  {c}
                </option>
              ))}
            </select>
            <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              Hold Ctrl/Cmd to select multiple
            </div>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Campaign</label>
            <select value={filters.campaign} onChange={(e) => setFilters({...filters, campaign: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
              {campaignOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Min Spend ($)</label>
            <input
              type="number"
              value={filters.minSpend}
              onChange={(e) => setFilters({...filters, minSpend: parseFloat(e.target.value) || 0})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              placeholder="0"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Showing <span className="font-semibold text-cyan-600">{filteredData.length.toLocaleString()}</span> ads
            {filters.persona.length > 0 && <span className="ml-2 text-cyan-600">• {filters.persona.length} persona(s) filtered</span>}
            {filters.concept.length > 0 && <span className="ml-2 text-cyan-600">• {filters.concept.length} concept(s) filtered</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportCSV}
              className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 bg-cyan-600 text-white hover:bg-cyan-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <button onClick={() => setFilters({ persona: [], concept: [], campaign: 'All', minSpend: 0 })}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Spend</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>${safeNumber(totals.spend / 1000, 1)}K</div>
        </div>
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Revenue</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>${safeNumber(totals.revenue / 1000, 1)}K</div>
        </div>
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Overall ROAS</div>
          <div className={`text-2xl font-bold ${overallRoas >= 2 ? 'text-green-600' : overallRoas >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
            {safeNumber(overallRoas, 2)}x
          </div>
        </div>
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Purchases</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{totals.purchases.toLocaleString()}</div>
        </div>
      </div>

      {/* No Data Warning */}
      {filters.persona.length > 0 && filteredData.length === 0 && (
        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-yellow-900/20 border-yellow-700' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-yellow-400' : 'text-yellow-800'}`}>
                No Data Found
              </h3>
              <p className={`text-sm mb-3 ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                No data found for persona: <span className="font-semibold">{filters.persona.join(', ')}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Spend vs ROAS Bar Chart */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Spend vs ROAS by Persona
        </h3>
        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={personaAggregated} margin={{ bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
            <XAxis 
              dataKey="persona" 
              stroke={isDark ? '#9CA3AF' : '#6B7280'}
              angle={-60}
              textAnchor="end"
              height={120}
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis 
              yAxisId="left"
              stroke={isDark ? '#9CA3AF' : '#6B7280'}
              label={{ value: 'Spend ($)', angle: -90, position: 'insideLeft' }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="#10B981"
              label={{ value: 'ROAS', angle: 90, position: 'insideRight' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF', 
                border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="spend" fill="#06B6D4" name="Spend ($)" />
            <Bar yAxisId="right" dataKey="roas" fill="#10B981" name="ROAS" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly Trend Line Chart */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Persona Performance Over Time
        </h3>
        <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Weekly spend by top personas (showing top 5 by total spend)
        </p>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={weeklyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
            <XAxis 
              dataKey="week" 
              stroke={isDark ? '#9CA3AF' : '#6B7280'}
              angle={0}
              textAnchor="middle"
              height={60}
              tick={{ fontSize: 10 }}
              interval={0}
            />
            <YAxis 
              yAxisId="left"
              stroke={isDark ? '#9CA3AF' : '#6B7280'}
              label={{ value: 'Spend ($)', angle: -90, position: 'insideLeft' }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="#F97316"
              label={{ value: 'Revenue ($)', angle: 90, position: 'insideRight' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF', 
                border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                borderRadius: '8px'
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            
            {filteredPersonas.slice(0, 5).map((persona, index) => {
              const dataKey = `${persona}_spend`
              const color = personaColors[persona] || ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'][index]
              
              return (
                <Line
                  key={dataKey}
                  yAxisId="left"
                  type="monotone"
                  dataKey={dataKey}
                  stroke={color}
                  strokeWidth={3}
                  dot={{ r: 5 }}
                  name={`${persona} Spend`}
                />
              )
            })}
            
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="total_revenue"
              stroke="#F97316"
              strokeWidth={4}
              dot={{ fill: '#F97316', r: 6 }}
              name="Total Revenue"
            />
          </LineChart>
        </ResponsiveContainer>
        
        <div className={`mt-4 grid grid-cols-auto-fit gap-2`} style={{gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))'}}>
          {filteredPersonas.slice(0, 5).map(persona => {
            const personaRows = filteredData.filter(d => d.persona === persona)
            const personaSpend = personaRows.reduce((sum, d) => sum + (d.spend || 0), 0)
            const personaRevenue = personaRows.reduce((sum, d) => sum + (d.revenue || 0), 0)
            const avgRoas = personaSpend > 0 ? personaRevenue / personaSpend : 0
            
            return (
              <div key={persona} className={`p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{persona}</div>
                <div className={`text-sm font-semibold ${avgRoas >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                  Avg ROAS: {safeNumber(avgRoas, 2)}x
                </div>
                <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                  Spend: ${safeNumber(personaSpend / 1000, 1)}K
                </div>
              </div>
            )
          })}
        </div>
        
        {filteredPersonas.length > 5 && (
          <div className={`mt-4 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Showing top 5 personas by spend. Use filters above to see specific personas.
          </div>
        )}
      </div>

      {/* Detailed Table with Sorting */}
      <div className={`rounded-xl overflow-hidden shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Detailed Data</h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Showing all {filteredData.length.toLocaleString()} rows
                {sortField && (
                  <span className="ml-2 text-cyan-500">
                    • Sorted by {sortableColumns.find(c => c.key === sortField)?.label} ({sortDirection === 'asc' ? '↑ low to high' : '↓ high to low'})
                  </span>
                )}
              </p>
            </div>
            {sortField && (
              <button
                onClick={() => { setSortField(null); setSortDirection(null) }}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Clear Sort
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs">
            <thead className={`sticky top-0 z-10 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
              <tr>
                {sortableColumns.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-3 py-3 text-xs font-medium uppercase cursor-pointer select-none transition-colors
                      ${col.align === 'right' ? 'text-right' : 'text-left'}
                      ${sortField === col.key
                        ? (isDark ? 'text-cyan-400 bg-gray-800' : 'text-cyan-700 bg-cyan-50')
                        : (isDark ? 'text-gray-300 hover:text-cyan-400 hover:bg-gray-800' : 'text-gray-600 hover:text-cyan-700 hover:bg-gray-100')
                      }`}
                  >
                    <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                      {col.label}
                      <SortIndicator columnKey={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {sortedData.map((row, idx) => (
                <tr key={idx} className={`${isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}`}>
                  <td className={`px-3 py-2 whitespace-nowrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{row.week}</td>
                  <td className={`px-3 py-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{row.campaign_name}</td>
                  <td className={`px-3 py-2 max-w-xs truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`} title={row.ad_name}>{row.ad_name}</td>
                  <td className={`px-3 py-2 whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      row.persona.includes('Male') ? 'bg-blue-900/30 text-blue-400' :
                      row.persona.includes('Female') ? 'bg-pink-900/30 text-pink-400' :
                      row.persona === 'BLK' ? 'bg-purple-900/30 text-purple-400' :
                      row.persona.includes('Passport') ? 'bg-blue-900/30 text-blue-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {row.persona}
                    </span>
                  </td>
                  <td className={`px-3 py-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{row.concept_code}</td>
                  <td className={`px-3 py-2 text-right whitespace-nowrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>${safeNumber(row.spend, 2)}</td>
                  <td className={`px-3 py-2 text-right whitespace-nowrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>${safeNumber(row.revenue, 2)}</td>
                  <td className={`px-3 py-2 text-right whitespace-nowrap font-semibold ${row.roas >= 2 ? 'text-green-600' : row.roas >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {safeNumber(row.roas, 2)}x
                  </td>
                  <td className={`px-3 py-2 text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{row.purchases || 0}</td>
                  <td className={`px-3 py-2 text-right whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>${safeNumber(row.cost_per_purchase, 2)}</td>
                  <td className={`px-3 py-2 text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{(row.impressions || 0).toLocaleString()}</td>
                  <td className={`px-3 py-2 text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{(row.link_clicks || 0).toLocaleString()}</td>
                  <td className={`px-3 py-2 text-right whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{safeNumber((row.ctr || 0) * 100, 2)}%</td>
                  <td className={`px-3 py-2 text-right whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>${safeNumber(row.cpm, 2)}</td>
                  <td className={`px-3 py-2 text-right whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>${safeNumber(row.cpc, 2)}</td>
                  <td className={`px-3 py-2 text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{safeNumber(row.frequency, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}