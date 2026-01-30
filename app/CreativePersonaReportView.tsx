'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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
  const [filters, setFilters] = useState({
    persona: [] as string[],
    concept: [] as string[],
    campaign: 'All',
    minSpend: 0
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    
    try {
      const { data: reportData, error } = await supabase
        .from('creative_persona_report')
        .select('*')
        .order('Week', { ascending: true }) // ✅ FIXED: Use 'Week' with capital W

      if (error) {
        console.error('Error fetching creative persona report:', error)
        setLoading(false)
        return
      }

      console.log('📊 Total rows fetched:', reportData?.length)
      console.log('📊 Sample row:', reportData?.[0]) // Debug: see actual column names
      
      if (!reportData || reportData.length === 0) {
        console.warn('No data found in creative_persona_report')
        setLoading(false)
        return
      }

      // Enrich data with calculated fields
      const enrichedData = reportData.map((row: any) => {
        const amountSpent = parseFloat(row['Amount spent (USD)'] || 0)
        const revenue = parseFloat(row['Purchases conversion value'] || 0)
        const impressions = parseInt(row['Impressions'] || 0)
        const ctr = parseFloat(row['CTR (link click-through rate)'] || 0)
        
        return {
          ...row,
          // Add computed fields for easier access
          roas: row['Purchase ROAS (return on ad spend)'] || (amountSpent > 0 ? revenue / amountSpent : 0),
          ctr_percent: ctr * 100,
          cpm: row['CPM (cost per 1,000 impressions)'] || (impressions > 0 ? (amountSpent / impressions) * 1000 : 0)
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
    // Extract persona from campaign name
    const campaignName = row['Campaign name'] || ''
    const persona = campaignName.match(/(PassportBro|PassportGirl|Passport Bros|30-60|BLK|IndianBoy)/i)?.[0] || 'Unknown'
    
    if (filters.persona.length > 0 && !filters.persona.includes(persona)) {
      return false
    }
    
    if (filters.concept.length > 0) {
      const adName = row['Ad name'] || ''
      const concept = adName.split('-')[1] || ''
      if (!filters.concept.includes(concept)) return false
    }
    
    if (filters.campaign !== 'All' && row['Campaign name'] !== filters.campaign) return false
    
    const spent = parseFloat(row['Amount spent (USD)'] || 0)
    if (spent < filters.minSpend) return false
    
    return true
  })

  // Get unique values for filters
  const personaOptions = ['All', ...new Set(data.map(d => {
    const campaignName = d['Campaign name'] || ''
    const match = campaignName.match(/(PassportBro|PassportGirl|Passport Bros|30-60|BLK|IndianBoy)/i)
    return match ? match[0] : 'Unknown'
  }).filter(Boolean))].sort()

  const conceptOptions = ['All', ...new Set(data.map(d => {
    const adName = d['Ad name'] || ''
    const parts = adName.split('-')
    return parts && parts.length > 1 ? parts[1] : 'Unknown'
  }).filter(Boolean))].sort()

  const campaignOptions = ['All', ...new Set(data.map(d => d['Campaign name']).filter(Boolean))].sort()

  // Aggregate by persona for bar chart
  const personaAggregated = Object.entries(
    filteredData.reduce((acc: any, row) => {
      const campaignName = row['Campaign name'] || ''
      const persona = campaignName.match(/(PassportBro|PassportGirl|Passport Bros|30-60|BLK|IndianBoy)/i)?.[0] || 'Unknown'
      
      if (!acc[persona]) {
        acc[persona] = {
          persona,
          spend: 0,
          revenue: 0,
          purchases: 0,
          impressions: 0
        }
      }
      
      acc[persona].spend += parseFloat(row['Amount spent (USD)'] || 0)
      acc[persona].revenue += parseFloat(row['Purchases conversion value'] || 0)
      acc[persona].purchases += parseInt(row['Purchases'] || 0)
      acc[persona].impressions += parseInt(row['Impressions'] || 0)
      
      return acc
    }, {})
  ).map(([persona, data]: [string, any]) => ({
    ...data,
    roas: data.spend > 0 ? data.revenue / data.spend : 0
  })).sort((a, b) => b.spend - a.spend)

  // Weekly trend by persona
  const weeklyTrend = Object.entries(
    filteredData.reduce((acc: any, row) => {
      const week = row['Week'] || 'Unknown'
      const campaignName = row['Campaign name'] || ''
      const persona = campaignName.match(/(PassportBro|PassportGirl|Passport Bros|30-60|BLK|IndianBoy)/i)?.[0] || 'Unknown'
      
      if (!acc[week]) {
        acc[week] = {
          week,
          total_revenue: 0
        }
      }
      
      const spendKey = `${persona}_spend`
      const roasKey = `${persona}_roas`
      
      if (!acc[week][spendKey]) {
        acc[week][spendKey] = 0
        acc[week][roasKey] = 0
        acc[week][`${persona}_revenue`] = 0
      }
      
      acc[week][spendKey] += parseFloat(row['Amount spent (USD)'] || 0)
      acc[week][`${persona}_revenue`] += parseFloat(row['Purchases conversion value'] || 0)
      acc[week].total_revenue += parseFloat(row['Purchases conversion value'] || 0)
      
      return acc
    }, {})
  ).map(([week, data]: [string, any]) => {
    const result: any = { week, total_revenue: data.total_revenue }
    
    personaOptions.slice(1).forEach(persona => {
      const spendKey = `${persona}_spend`
      const revenueKey = `${persona}_revenue`
      const roasKey = `${persona}_roas`
      
      result[spendKey] = data[spendKey] || 0
      result[roasKey] = data[spendKey] > 0 ? (data[revenueKey] || 0) / data[spendKey] : 0
    })
    
    return result
  }).sort((a, b) => a.week.localeCompare(b.week))

  // Calculate totals
  const totals = filteredData.reduce((acc, row) => {
    acc.spend += parseFloat(row['Amount spent (USD)'] || 0)
    acc.revenue += parseFloat(row['Purchases conversion value'] || 0)
    acc.purchases += parseInt(row['Purchases'] || 0)
    acc.impressions += parseInt(row['Impressions'] || 0)
    return acc
  }, { spend: 0, revenue: 0, purchases: 0, impressions: 0 })

  const overallRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0

  // Define colors for personas
  const personaColors: Record<string, string> = {
    'PassportBro': '#3B82F6',
    'Passport Bros': '#3B82F6',
    'PassportGirl': '#EF4444',
    '30-60': '#10B981',
    'BLK': '#8B5CF6',
    'IndianBoy': '#F59E0B',
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
          📊 Creative Persona Report
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
            Showing <span className="font-semibold text-cyan-600">{filteredData.length}</span> ads
            {filters.persona.length > 0 && <span className="ml-2 text-cyan-600">• {filters.persona.length} persona(s) filtered</span>}
            {filters.concept.length > 0 && <span className="ml-2 text-cyan-600">• {filters.concept.length} concept(s) filtered</span>}
          </div>
          <button onClick={() => setFilters({ persona: [], concept: [], campaign: 'All', minSpend: 0 })}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            Clear Filters
          </button>
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

      {/* Spend vs ROAS Bar Chart */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Spend vs ROAS by Persona
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={personaAggregated}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
            <XAxis 
              dataKey="persona" 
              stroke={isDark ? '#9CA3AF' : '#6B7280'}
              angle={-45}
              textAnchor="end"
              height={80}
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
              formatter={(value: any, name: string) => {
                if (name === 'ROAS') return [safeNumber(value, 2) + 'x', name]
                return ['$' + safeNumber(value, 0), name]
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
          Weekly spend by persona with ROAS values
        </p>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={weeklyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
            <XAxis 
              dataKey="week" 
              stroke={isDark ? '#9CA3AF' : '#6B7280'}
              angle={-45}
              textAnchor="end"
              height={100}
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
              stroke="#F97316"
              label={{ value: 'Revenue ($)', angle: 90, position: 'insideRight' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF', 
                border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                borderRadius: '8px'
              }}
              formatter={(value: any, name: string) => {
                if (name.includes('roas')) return [safeNumber(value, 2) + 'x', name]
                return ['$' + safeNumber(value, 0), name]
              }}
            />
            <Legend />
            
            {personaOptions.slice(1).map((persona, index) => (
              <Line
                key={`${persona}_spend`}
                yAxisId="left"
                type="monotone"
                dataKey={`${persona}_spend`}
                stroke={personaColors[persona] || '#6B7280'}
                strokeWidth={2}
                dot={{ r: 4 }}
                name={`${persona} Spend`}
              />
            ))}
            
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="total_revenue"
              stroke="#F97316"
              strokeWidth={3}
              dot={{ fill: '#F97316', r: 5 }}
              name="US Revenue"
            />
          </LineChart>
        </ResponsiveContainer>
        
        <div className="mt-4 grid grid-cols-5 gap-2">
          {personaOptions.slice(1).map(persona => {
            const avgRoas = weeklyTrend.reduce((sum, week) => sum + (week[`${persona}_roas`] || 0), 0) / (weeklyTrend.length || 1)
            return (
              <div key={persona} className={`p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{persona}</div>
                <div className={`text-sm font-semibold ${avgRoas >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                  Avg ROAS: {safeNumber(avgRoas, 2)}x
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detailed Table */}
      <div className={`rounded-xl overflow-hidden shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="p-6">
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Detailed Data</h3>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full">
            <thead className={`sticky top-0 ${isDark ? 'bg-gray-750' : 'bg-gray-50'}`}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Week</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Campaign</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Ad Name</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Spend</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Revenue</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>ROAS</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Purchases</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {filteredData.slice(0, 100).map((row, idx) => (
                <tr key={idx} className={`${isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}`}>
                  <td className={`px-4 py-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{row['Week']}</td>
                  <td className={`px-4 py-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{row['Campaign name']}</td>
                  <td className={`px-4 py-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{row['Ad name']}</td>
                  <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>${safeNumber(row['Amount spent (USD)'], 0)}</td>
                  <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>${safeNumber(row['Purchases conversion value'], 0)}</td>
                  <td className={`px-4 py-2 text-sm text-right ${row.roas >= 2 ? 'text-green-600' : row.roas >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {safeNumber(row.roas, 2)}x
                  </td>
                  <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{row['Purchases'] || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredData.length > 100 && (
          <div className={`p-4 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Showing first 100 rows of {filteredData.length} total
          </div>
        )}
      </div>
    </div>
  )
}