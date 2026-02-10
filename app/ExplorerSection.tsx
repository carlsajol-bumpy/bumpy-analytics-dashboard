'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, Cell, ReferenceLine } from 'recharts'
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

interface CreativePersonaReportViewProps {
  isDark?: boolean
}

export default function CreativePersonaReportView({ isDark }: CreativePersonaReportViewProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'charts' | 'scatter'>('charts')
  const [filters, setFilters] = useState({
    persona: [] as string[],
    concept: [] as string[],
    campaign: 'All',
    minSpend: 0,
    dateStart: '',
    dateEnd: ''
  })

  // Scatter plot configuration
  const [scatterConfig, setScatterConfig] = useState({
    xAxis: 'spend',
    yAxis: 'roas',
    maxItems: 500,
    minSpendForScatter: 10
  })

  // Available metrics for X/Y axis
  const availableMetrics = [
    { value: 'spend', label: 'Spend ($)', format: (v: number) => `$${v.toFixed(0)}` },
    { value: 'revenue', label: 'Revenue ($)', format: (v: number) => `$${v.toFixed(0)}` },
    { value: 'roas', label: 'ROAS', format: (v: number) => `${v.toFixed(2)}x` },
    { value: 'purchases', label: 'Purchases', format: (v: number) => v.toFixed(0) },
    { value: 'impressions', label: 'Impressions', format: (v: number) => v.toFixed(0) },
    { value: 'link_clicks', label: 'Link Clicks', format: (v: number) => v.toFixed(0) },
    { value: 'cpm', label: 'CPM ($)', format: (v: number) => `$${v.toFixed(2)}` },
    { value: 'ctr', label: 'CTR (%)', format: (v: number) => `${(v * 100).toFixed(2)}%` },
    { value: 'cost_per_purchase', label: 'CPP ($)', format: (v: number) => `$${v.toFixed(2)}` },
    { value: 'frequency', label: 'Frequency', format: (v: number) => v.toFixed(2) }
  ]

  // CSV Export Function
  const handleExportCSV = () => {
    const personaLabel = filters.persona.length > 0 ? filters.persona.join('_') : 'all'
    const conceptLabel = filters.concept.length > 0 ? filters.concept.join('_') : 'all'
    const filename = `creative_report_${personaLabel}_${conceptLabel}`
    
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
  }, [filters.dateStart, filters.dateEnd])

  // Extract persona from AD NAME - position 3
  const extractPersona = (adName: string): string => {
    if (!adName) return 'Unknown'
    const parts = adName.split('-')
    return parts[3] || 'Unknown'
  }

  // Extract concept from AD NAME - position 2
  const extractConceptCode = (adName: string): string => {
    if (!adName) return 'Unknown'
    const parts = adName.split('-')
    return parts[2] || 'Unknown'
  }

  async function fetchData() {
    setLoading(true)
    
    try {
      let query = supabase
        .from('creative_persona_report')
        .select('*')
        .order('Week', { ascending: false })

      // Apply date filters if provided
      if (filters.dateStart || filters.dateEnd) {
        // Note: You may need to add date_start and date_end columns to creative_persona_report table
        if (filters.dateStart) {
          query = query.gte('date_start', filters.dateStart)
        }
        if (filters.dateEnd) {
          query = query.lte('date_end', filters.dateEnd)
        }
      }

      const { data: reportData, error } = await query

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
          cost_per_purchase: row['Cost per purchase'] || (purchases > 0 ? amountSpent / purchases : 0)
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

  // Get unique values for filters
  const personaOptions = ['All', ...new Set(data.map(d => d.persona).filter(Boolean))].sort()
  const conceptOptions = ['All', ...new Set(data.map(d => d.concept_code).filter(Boolean))].sort()
  const campaignOptions = ['All', ...new Set(data.map(d => d.campaign_name).filter(Boolean))].sort()

  // Aggregate by persona for bar chart
  const personaAggregated = Object.entries(
    filteredData.reduce((acc: any, row) => {
      const persona = row.persona || 'Unknown'
      
      if (!acc[persona]) {
        acc[persona] = {
          persona,
          spend: 0,
          revenue: 0,
          purchases: 0,
          impressions: 0
        }
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
        acc[week] = {
          week,
          total_revenue: 0
        }
      }
      
      const spendKey = `${persona}_spend`
      
      if (!acc[week][spendKey]) {
        acc[week][spendKey] = 0
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

  // Prepare scatter plot data with filtering and limiting for performance
  const scatterDataFiltered = filteredData
    .filter(item => item[scatterConfig.xAxis] >= scatterConfig.minSpendForScatter) // Filter out very low spend
    .sort((a, b) => b.spend - a.spend) // Sort by spend descending
    .slice(0, scatterConfig.maxItems) // Limit to max items
  
  const scatterData = scatterDataFiltered.map(item => ({
    ...item,
    x: item[scatterConfig.xAxis],
    y: item[scatterConfig.yAxis],
    z: item.spend,
    label: `${item.ad_name?.substring(0, 30)}...`
  }))

  // Calculate medians for quadrant lines
  const xValues = scatterData.map(d => d.x).filter(v => v > 0).sort((a, b) => a - b)
  const yValues = scatterData.map(d => d.y).filter(v => v > 0).sort((a, b) => a - b)
  const xMedian = xValues.length > 0 ? xValues[Math.floor(xValues.length / 2)] : 0
  const yMedian = yValues.length > 0 ? yValues[Math.floor(yValues.length / 2)] : 0

  // Determine quadrant and color
  const getQuadrantInfo = (x: number, y: number) => {
    if (x >= xMedian && y >= yMedian) {
      return { quadrant: 'High-High', color: '#10B981', label: 'Winners' }
    } else if (x < xMedian && y >= yMedian) {
      return { quadrant: 'Low-High', color: '#F59E0B', label: 'Hidden Gems' }
    } else if (x >= xMedian && y < yMedian) {
      return { quadrant: 'High-Low', color: '#EF4444', label: 'Needs Attention' }
    } else {
      return { quadrant: 'Low-Low', color: '#6B7280', label: 'Test/Low' }
    }
  }

  const scatterDataWithQuadrants = scatterData.map(d => ({
    ...d,
    ...getQuadrantInfo(d.x, d.y)
  }))

  const CustomScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const xMetric = availableMetrics.find(m => m.value === scatterConfig.xAxis)
      const yMetric = availableMetrics.find(m => m.value === scatterConfig.yAxis)
      
      return (
        <div className={`rounded-lg p-4 shadow-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`font-semibold mb-2 text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {data.label}
          </div>
          <div className={`text-xs space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <div className="flex justify-between gap-4">
              <span>Persona:</span>
              <span className="font-medium">{data.persona}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Concept:</span>
              <span className="font-medium">{data.concept_code}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>{xMetric?.label}:</span>
              <span className="font-medium">{xMetric?.format(data.x)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>{yMetric?.label}:</span>
              <span className="font-medium">{yMetric?.format(data.y)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Quadrant:</span>
              <span className="font-medium" style={{ color: data.color }}>{data.label}</span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

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
          <span className={`ml-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Loading creative report...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Creative Performance Analysis
        </h2>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Analyze creative performance by persona, concept, and time period
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

        <div className="grid grid-cols-6 gap-4 mb-4">
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Persona {filters.persona.length > 0 && <span className="text-cyan-600">({filters.persona.length})</span>}
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
              Hold Ctrl/Cmd
            </div>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Concept {filters.concept.length > 0 && <span className="text-cyan-600">({filters.concept.length})</span>}
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
              Hold Ctrl/Cmd
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
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Date Start</label>
            <input
              type="date"
              value={filters.dateStart}
              onChange={(e) => setFilters({...filters, dateStart: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Date End</label>
            <input
              type="date"
              value={filters.dateEnd}
              onChange={(e) => setFilters({...filters, dateEnd: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
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
            Showing <span className="font-semibold text-cyan-600">{filteredData.length.toLocaleString()}</span> creatives
            {filters.dateStart && <span className="ml-2">| From: {filters.dateStart}</span>}
            {filters.dateEnd && <span className="ml-2">| To: {filters.dateEnd}</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportCSV}
              className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 bg-cyan-600 text-white hover:bg-cyan-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <button onClick={() => setFilters({ persona: [], concept: [], campaign: 'All', minSpend: 0, dateStart: '', dateEnd: '' })}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              Clear Filters
            </button>
            <button
              onClick={() => setViewMode('scatter')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${viewMode === 'scatter' ? 'bg-cyan-600 text-white' : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Scatter Plot
            </button>
            <button
              onClick={() => setViewMode('charts')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${viewMode === 'charts' ? 'bg-cyan-600 text-white' : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Charts
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${viewMode === 'table' ? 'bg-cyan-600 text-white' : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Table
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

      {/* Views */}
      {viewMode === 'scatter' ? (
        <div className="space-y-6">
          {/* X-Y Axis Configuration */}
          <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Quadrant Analysis Configuration</h3>
            </div>

            {/* Quick Presets */}
            <div className="mb-4 flex gap-2 flex-wrap">
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Quick presets:</span>
              <button
                onClick={() => setScatterConfig({...scatterConfig, xAxis: 'spend', yAxis: 'roas', minSpendForScatter: 50, maxItems: 500})}
                className={`px-3 py-1 text-xs rounded transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                Spend vs ROAS (Top 500, $50+)
              </button>
              <button
                onClick={() => setScatterConfig({...scatterConfig, xAxis: 'spend', yAxis: 'purchases', minSpendForScatter: 100, maxItems: 250})}
                className={`px-3 py-1 text-xs rounded transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                Spend vs Purchases (Top 250, $100+)
              </button>
              <button
                onClick={() => setScatterConfig({...scatterConfig, xAxis: 'cpm', yAxis: 'ctr', minSpendForScatter: 20, maxItems: 500})}
                className={`px-3 py-1 text-xs rounded transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                CPM vs CTR (Top 500, $20+)
              </button>
              <button
                onClick={() => setScatterConfig({...scatterConfig, xAxis: 'impressions', yAxis: 'roas', minSpendForScatter: 10, maxItems: 1000})}
                className={`px-3 py-1 text-xs rounded transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                Impressions vs ROAS (Top 1000, $10+)
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>X-Axis (Horizontal)</label>
                <select
                  value={scatterConfig.xAxis}
                  onChange={(e) => setScatterConfig({...scatterConfig, xAxis: e.target.value})}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  {availableMetrics.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Y-Axis (Vertical)</label>
                <select
                  value={scatterConfig.yAxis}
                  onChange={(e) => setScatterConfig({...scatterConfig, yAxis: e.target.value})}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  {availableMetrics.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Min Spend Threshold ($)</label>
                <input
                  type="number"
                  value={scatterConfig.minSpendForScatter}
                  onChange={(e) => setScatterConfig({...scatterConfig, minSpendForScatter: parseFloat(e.target.value) || 0})}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  placeholder="10"
                />
                <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Filter out low spend
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Max Items to Display</label>
                <select
                  value={scatterConfig.maxItems}
                  onChange={(e) => setScatterConfig({...scatterConfig, maxItems: parseInt(e.target.value)})}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  <option value="100">100 creatives</option>
                  <option value="250">250 creatives</option>
                  <option value="500">500 creatives</option>
                  <option value="1000">1000 creatives</option>
                  <option value="2000">2000 creatives</option>
                </select>
                <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Top by spend
                </div>
              </div>
            </div>

            {/* Quadrant Legend */}
            <div className="mt-4 grid grid-cols-4 gap-4">
              <div className={`flex items-center gap-2 p-3 rounded-lg ${isDark ? 'bg-green-900/20' : 'bg-green-50'}`}>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <div>
                  <div className={`text-xs font-semibold ${isDark ? 'text-green-400' : 'text-green-700'}`}>Winners</div>
                  <div className={`text-xs ${isDark ? 'text-green-500' : 'text-green-600'}`}>High X, High Y</div>
                </div>
              </div>
              <div className={`flex items-center gap-2 p-3 rounded-lg ${isDark ? 'bg-orange-900/20' : 'bg-orange-50'}`}>
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <div>
                  <div className={`text-xs font-semibold ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>Hidden Gems</div>
                  <div className={`text-xs ${isDark ? 'text-orange-500' : 'text-orange-600'}`}>Low X, High Y</div>
                </div>
              </div>
              <div className={`flex items-center gap-2 p-3 rounded-lg ${isDark ? 'bg-red-900/20' : 'bg-red-50'}`}>
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div>
                  <div className={`text-xs font-semibold ${isDark ? 'text-red-400' : 'text-red-700'}`}>Needs Attention</div>
                  <div className={`text-xs ${isDark ? 'text-red-500' : 'text-red-600'}`}>High X, Low Y</div>
                </div>
              </div>
              <div className={`flex items-center gap-2 p-3 rounded-lg ${isDark ? 'bg-gray-900/20' : 'bg-gray-50'}`}>
                <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                <div>
                  <div className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>Test/Low</div>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>Low X, Low Y</div>
                </div>
              </div>
            </div>
          </div>

          {/* Scatter Plot */}
          <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {availableMetrics.find(m => m.value === scatterConfig.xAxis)?.label} vs {availableMetrics.find(m => m.value === scatterConfig.yAxis)?.label}
              <span className={`text-sm font-normal ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                (Showing {scatterData.length.toLocaleString()} of {filteredData.length.toLocaleString()} creatives | Bubble size = Spend)
              </span>
            </h3>
            <ResponsiveContainer width="100%" height={600}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name={availableMetrics.find(m => m.value === scatterConfig.xAxis)?.label}
                  stroke={isDark ? '#9CA3AF' : '#6B7280'}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name={availableMetrics.find(m => m.value === scatterConfig.yAxis)?.label}
                  stroke={isDark ? '#9CA3AF' : '#6B7280'}
                />
                <Tooltip content={<CustomScatterTooltip />} />
                
                {/* Quadrant divider lines */}
                <ReferenceLine 
                  x={xMedian} 
                  stroke={isDark ? '#6B7280' : '#9CA3AF'} 
                  strokeDasharray="3 3" 
                  strokeWidth={2}
                  label={{ value: 'Median', fill: isDark ? '#9CA3AF' : '#6B7280', fontSize: 12 }}
                />
                <ReferenceLine 
                  y={yMedian} 
                  stroke={isDark ? '#6B7280' : '#9CA3AF'} 
                  strokeDasharray="3 3"
                  strokeWidth={2}
                  label={{ value: 'Median', fill: isDark ? '#9CA3AF' : '#6B7280', fontSize: 12 }}
                />
                
                <Scatter name="Creatives" data={scatterDataWithQuadrants} fill="#8884d8">
                  {scatterDataWithQuadrants.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>

            {/* Info about filtered data */}
            {filteredData.length > scatterData.length && (
              <div className={`mt-4 p-3 rounded-lg border ${isDark ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'}`}>
                <div className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                  <strong>Note:</strong> Showing top {scatterData.length} creatives by spend. 
                  {filteredData.length - scatterDataFiltered.length > 0 && (
                    <> {(filteredData.length - scatterDataFiltered.length).toLocaleString()} creatives filtered out with spend below ${scatterConfig.minSpendForScatter}.</>
                  )}
                  {' '}Adjust "Min Spend Threshold" and "Max Items" above to show different creatives.
                </div>
              </div>
            )}

            {/* Quadrant Stats */}
            <div className="mt-6 grid grid-cols-4 gap-4">
              {[
                { label: 'Winners', color: '#10B981', filter: (d: any) => d.x >= xMedian && d.y >= yMedian },
                { label: 'Hidden Gems', color: '#F59E0B', filter: (d: any) => d.x < xMedian && d.y >= yMedian },
                { label: 'Needs Attention', color: '#EF4444', filter: (d: any) => d.x >= xMedian && d.y < yMedian },
                { label: 'Test/Low', color: '#6B7280', filter: (d: any) => d.x < xMedian && d.y < yMedian }
              ].map((quadrant, idx) => {
                const creatives = scatterDataWithQuadrants.filter(quadrant.filter)
                const totalSpend = creatives.reduce((sum, c) => sum + c.spend, 0)
                const avgRoas = totalSpend > 0 ? creatives.reduce((sum, c) => sum + c.revenue, 0) / totalSpend : 0
                return (
                  <div key={idx} className={`rounded-lg p-4 border ${isDark ? 'bg-gray-750 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: quadrant.color }}></div>
                      <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{quadrant.label}</div>
                    </div>
                    <div className={`text-xs space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      <div>{creatives.length} creatives</div>
                      <div>${safeNumber(totalSpend, 0)} spent</div>
                      <div>Avg ROAS: {safeNumber(avgRoas, 2)}x</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : viewMode === 'charts' ? (
        <div className="space-y-6">
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
                  angle={-45}
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
        </div>
      ) : (
        /* Detailed Table */
        <div className={`rounded-xl overflow-hidden shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="p-6">
            <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Detailed Data</h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Showing all {filteredData.length.toLocaleString()} rows
            </p>
          </div>
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-xs">
              <thead className={`sticky top-0 ${isDark ? 'bg-gray-750' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-3 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Week</th>
                  <th className={`px-3 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Campaign</th>
                  <th className={`px-3 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Ad Name</th>
                  <th className={`px-3 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Persona</th>
                  <th className={`px-3 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Concept</th>
                  <th className={`px-3 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Spend</th>
                  <th className={`px-3 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Revenue</th>
                  <th className={`px-3 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>ROAS</th>
                  <th className={`px-3 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Purchases</th>
                  <th className={`px-3 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>CPP</th>
                  <th className={`px-3 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Impressions</th>
                  <th className={`px-3 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Clicks</th>
                  <th className={`px-3 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>CTR</th>
                  <th className={`px-3 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>CPM</th>
                  <th className={`px-3 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Frequency</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {filteredData.map((row, idx) => (
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
                    <td className={`px-3 py-2 text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{safeNumber(row.frequency, 2)}</td>
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