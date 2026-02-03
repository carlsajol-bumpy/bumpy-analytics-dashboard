'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { exportToCSV } from '../lib/csvExport'

interface ConceptPerformanceViewProps {
  isDark?: boolean
}

function safeNumber(value: any, decimals: number = 2): string {
  const num = parseFloat(value)
  if (isNaN(num) || num === undefined || num === null) {
    return (0).toFixed(decimals)
  }
  return num.toFixed(decimals)
}

// Map timeframe filter to actual column suffixes in database
const TIMEFRAME_COLUMN_MAP: Record<string, string> = {
  '7d': '7d',
  '14d': 'prev',  // 14d data is in _prev columns
  '28d': '28d',
  '30d': '30d'
}

export default function ConceptPerformanceView({ isDark }: ConceptPerformanceViewProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  const [sortField, setSortField] = useState('spend')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  const [filters, setFilters] = useState({
    timeframe: '7d',
    status: 'All',
    device: 'All',
    country: 'All',
    minSpend: 0
  })

  // CSV Export Function
  const handleExportCSV = () => {
    const timeframeLabel = filters.timeframe
    const filename = `concepts_${timeframeLabel}${filters.status !== 'All' ? `_${filters.status}` : ''}`
    
    exportToCSV(
      sortedData,
      filename,
      [
        { key: 'concept_code', label: 'Concept' },
        { key: 'spend', label: `Spend ${timeframeLabel} ($)` },
        { key: 'revenue', label: `Revenue ${timeframeLabel} ($)` },
        { key: 'roas', label: `ROAS ${timeframeLabel}` },
        { key: 'conversions', label: `Conversions ${timeframeLabel}` },
        { key: 'impressions', label: `Impressions ${timeframeLabel}` },
        { key: 'clicks', label: `Clicks ${timeframeLabel}` },
        { key: 'cpm', label: `CPM ${timeframeLabel} ($)` },
        { key: 'ctr', label: `CTR ${timeframeLabel}` },
        { key: 'cpi', label: `CPI ${timeframeLabel} ($)` },
        { key: 'cpp', label: `CPP ${timeframeLabel} ($)` },
        { key: 'ad_count', label: 'Total Ads' },
        { key: 'active_ad_count', label: 'Active Ads' }
      ]
    )
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    
    try {
      const { data: creativesData, error } = await supabase
        .from('creative_performance')
        .select('*')
        .limit(10000)

      if (error) {
        console.error('Error fetching creative performance:', error)
        setLoading(false)
        return
      }

      console.log('Fetched', creativesData?.length, 'ads for concept analysis')

      if (!creativesData || creativesData.length === 0) {
        console.warn('No creative performance data found')
        setLoading(false)
        return
      }

      // Group by concept_code and aggregate ALL timeframes
      const conceptMap = new Map<string, any>()

      creativesData.forEach((ad: any) => {
        const concept = ad.concept_code || 'Unknown'
        
        if (!conceptMap.has(concept)) {
          conceptMap.set(concept, {
            concept_code: concept,
            ads: [],
            // 7d metrics
            spend_7d: 0,
            revenue_7d: 0,
            impressions_7d: 0,
            clicks_7d: 0,
            conversions_7d: 0,
            // 14d metrics (from _prev columns)
            spend_prev: 0,
            revenue_prev: 0,
            impressions_prev: 0,
            clicks_prev: 0,
            conversions_prev: 0,
            // 28d metrics
            spend_28d: 0,
            revenue_28d: 0,
            impressions_28d: 0,
            clicks_28d: 0,
            conversions_28d: 0,
            // 30d metrics
            spend_30d: 0,
            revenue_30d: 0,
            impressions_30d: 0,
            clicks_30d: 0,
            conversions_30d: 0,
            ad_count: 0,
            active_ad_count: 0
          })
        }

        const conceptData = conceptMap.get(concept)
        conceptData.ads.push(ad)
        conceptData.ad_count += 1
        
        if (ad.status === 'ACTIVE') {
          conceptData.active_ad_count += 1
        }

        // Aggregate 7d metrics
        conceptData.spend_7d += parseFloat(ad.spend_7d || 0)
        conceptData.revenue_7d += parseFloat(ad.revenue_7d || 0)
        conceptData.impressions_7d += parseInt(ad.impressions_7d || 0)
        conceptData.clicks_7d += parseInt(ad.clicks_7d || 0)
        conceptData.conversions_7d += parseInt(ad.conversions_7d || 0)

        // Aggregate 14d metrics (from _prev columns)
        conceptData.spend_prev += parseFloat(ad.spend_prev || 0)
        conceptData.revenue_prev += parseFloat(ad.revenue_prev || 0)
        conceptData.impressions_prev += parseInt(ad.impressions_prev || 0)
        conceptData.clicks_prev += parseInt(ad.clicks_prev || 0)
        conceptData.conversions_prev += parseInt(ad.conversions_prev || 0)

        // Aggregate 28d metrics
        conceptData.spend_28d += parseFloat(ad.spend_28d || 0)
        conceptData.revenue_28d += parseFloat(ad.revenue_28d || 0)
        conceptData.impressions_28d += parseInt(ad.impressions_28d || 0)
        conceptData.clicks_28d += parseInt(ad.clicks_28d || 0)
        conceptData.conversions_28d += parseInt(ad.conversions_28d || 0)

        // Aggregate 30d metrics
        conceptData.spend_30d += parseFloat(ad.spend_30d || 0)
        conceptData.revenue_30d += parseFloat(ad.revenue_30d || 0)
        conceptData.impressions_30d += parseInt(ad.impressions_30d || 0)
        conceptData.clicks_30d += parseInt(ad.clicks_30d || 0)
        conceptData.conversions_30d += parseInt(ad.conversions_30d || 0)
      })

      // Calculate derived metrics for ALL timeframes
      const conceptsArray = Array.from(conceptMap.values()).map(concept => {
        const result: any = { ...concept }

        // Calculate metrics for each timeframe
        const timeframes = ['7d', 'prev', '28d', '30d']
        timeframes.forEach(tf => {
          const spend = concept[`spend_${tf}`]
          const revenue = concept[`revenue_${tf}`]
          const impressions = concept[`impressions_${tf}`]
          const clicks = concept[`clicks_${tf}`]
          const conversions = concept[`conversions_${tf}`]

          result[`roas_${tf}`] = spend > 0 ? revenue / spend : 0
          result[`cpm_${tf}`] = impressions > 0 ? (spend / impressions) * 1000 : 0
          result[`ctr_${tf}`] = impressions > 0 ? (clicks / impressions) : 0
          result[`cpi_${tf}`] = conversions > 0 ? spend / conversions : 0
          result[`cpp_${tf}`] = conversions > 0 ? spend / conversions : 0
        })

        return result
      })

      console.log('📊 Aggregated', conceptsArray.length, 'concepts with all timeframes')
      setData(conceptsArray)
    } catch (err) {
      console.error('Error:', err)
    }
    
    setLoading(false)
  }

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Get the current column suffix based on selected timeframe
  const getColumnSuffix = () => TIMEFRAME_COLUMN_MAP[filters.timeframe]

  const filteredData = data.filter(item => {
    const columnSuffix = getColumnSuffix()
    const spend = item[`spend_${columnSuffix}`]
    
    if (spend < filters.minSpend) return false
    
    if (filters.status !== 'All') {
      const hasStatusAd = item.ads.some((ad: any) => ad.status === filters.status)
      if (!hasStatusAd) return false
    }
    
    if (filters.device !== 'All') {
      const hasDeviceAd = item.ads.some((ad: any) => ad.primary_device === filters.device)
      if (!hasDeviceAd) return false
    }
    
    if (filters.country !== 'All') {
      const hasCountryAd = item.ads.some((ad: any) => ad.primary_country === filters.country)
      if (!hasCountryAd) return false
    }
    
    return true
  })

  // Add current timeframe data to each item for sorting and display
  const enrichedData = filteredData.map(item => {
    const columnSuffix = getColumnSuffix()
    return {
      ...item,
      spend: item[`spend_${columnSuffix}`],
      revenue: item[`revenue_${columnSuffix}`],
      roas: item[`roas_${columnSuffix}`],
      conversions: item[`conversions_${columnSuffix}`],
      impressions: item[`impressions_${columnSuffix}`],
      clicks: item[`clicks_${columnSuffix}`],
      cpm: item[`cpm_${columnSuffix}`],
      ctr: item[`ctr_${columnSuffix}`],
      cpi: item[`cpi_${columnSuffix}`],
      cpp: item[`cpp_${columnSuffix}`]
    }
  })

  const sortedData = [...enrichedData].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    
    return sortDirection === 'asc' 
      ? String(aVal || '').localeCompare(String(bVal || ''))
      : String(bVal || '').localeCompare(String(aVal || ''))
  })

  const totals = enrichedData.reduce((acc, item) => {
    acc.spend += item.spend || 0
    acc.revenue += item.revenue || 0
    acc.impressions += item.impressions || 0
    acc.clicks += item.clicks || 0
    acc.conversions += item.conversions || 0
    return acc
  }, { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 })

  const overallRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0
  const overallCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
  const overallCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) : 0
  const overallCpi = totals.conversions > 0 ? totals.spend / totals.conversions : 0

  const allAds = data.flatMap(c => c.ads || [])
  const deviceOptions = ['All', ...new Set(allAds.map((ad: any) => ad.primary_device).filter(Boolean))].sort()
  const countryOptions = ['All', ...new Set(allAds.map((ad: any) => ad.primary_country).filter(Boolean))].sort()

  const toggleConceptSelection = (concept: string) => {
    if (selectedConcepts.includes(concept)) {
      setSelectedConcepts(selectedConcepts.filter(c => c !== concept))
    } else {
      setSelectedConcepts([...selectedConcepts, concept])
    }
  }

  const chartData = selectedConcepts.length > 0
    ? sortedData.filter(item => selectedConcepts.includes(item.concept_code))
    : sortedData.slice(0, 10)

  const SortIcon = ({ field }: { field: string }) => (
    <svg 
      className={`w-4 h-4 inline ml-1 ${sortField === field ? 'text-cyan-600' : 'text-gray-400'}`}
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortField === field && sortDirection === 'asc' ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
    </svg>
  )

  if (loading) {
    return (
      <div className={`rounded-xl p-12 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          <span className={`ml-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Loading concept performance...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Filters</h3>
        </div>

        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Timeframe</label>
            <select
              value={filters.timeframe}
              onChange={(e) => setFilters({...filters, timeframe: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              <option value="7d">Last 7 Days</option>
              <option value="14d">Last 14 Days</option>
              <option value="28d">Last 28 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              <option value="All">All</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Device</label>
            <select
              value={filters.device}
              onChange={(e) => setFilters({...filters, device: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {deviceOptions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Country</label>
            <select
              value={filters.country}
              onChange={(e) => setFilters({...filters, country: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
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

        <div className="flex items-center justify-between mt-4">
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Showing {sortedData.length} concepts ({filters.timeframe})
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportCSV}
              className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 bg-cyan-600 text-white hover:bg-cyan-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={() => setFilters({ timeframe: '7d', status: 'All', device: 'All', country: 'All', minSpend: 0 })}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Clear Filters
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'table' ? 'chart' : 'table')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {viewMode === 'table' ? 'Show Charts' : 'Show Table'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-6 gap-4">
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Spend ({filters.timeframe})</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ${safeNumber(totals.spend / 1000, 1)}K
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Revenue</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ${safeNumber(totals.revenue / 1000, 1)}K
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Overall ROAS</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {safeNumber(overallRoas, 2)}x
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Avg CPM</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ${safeNumber(overallCpm, 2)}
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Avg CTR</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {safeNumber(overallCtr * 100, 2)}%
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Avg CPI</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ${safeNumber(overallCpi, 2)}
          </div>
        </div>
      </div>

      {/* Charts or Table */}
      {viewMode === 'chart' ? (
        <div className="space-y-6">
          {/* Spend vs ROAS Chart */}
          <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Spend vs ROAS by Concept ({filters.timeframe}) {selectedConcepts.length > 0 ? `- ${selectedConcepts.length} selected` : '- Top 10'}
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                <XAxis dataKey="concept_code" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                <YAxis yAxisId="left" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                <YAxis yAxisId="right" orientation="right" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
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

          {/* Performance Trends */}
          <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Performance Trends - CPM, CPI, CPP ({filters.timeframe})
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                <XAxis dataKey="concept_code" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                <YAxis stroke={isDark ? '#9CA3AF' : '#6B7280'} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="cpm" stroke="#8B5CF6" name="CPM ($)" strokeWidth={2} />
                <Line type="monotone" dataKey="cpi" stroke="#F59E0B" name="CPI ($)" strokeWidth={2} />
                <Line type="monotone" dataKey="cpp" stroke="#EF4444" name="CPP ($)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        /* Table View */
        <div className={`rounded-xl overflow-hidden shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isDark ? 'bg-gray-750' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    SELECT
                  </th>
                  <th onClick={() => handleSort('concept_code')} className={`px-4 py-3 text-left text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    Concept <SortIcon field="concept_code" />
                  </th>
                  <th onClick={() => handleSort('spend')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    Spend ({filters.timeframe}) <SortIcon field="spend" />
                  </th>
                  <th onClick={() => handleSort('revenue')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    Revenue <SortIcon field="revenue" />
                  </th>
                  <th onClick={() => handleSort('roas')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    ROAS <SortIcon field="roas" />
                  </th>
                  <th onClick={() => handleSort('conversions')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    Conversions <SortIcon field="conversions" />
                  </th>
                  <th onClick={() => handleSort('cpm')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    CPM <SortIcon field="cpm" />
                  </th>
                  <th onClick={() => handleSort('ctr')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    CTR <SortIcon field="ctr" />
                  </th>
                  <th onClick={() => handleSort('cpi')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    CPI <SortIcon field="cpi" />
                  </th>
                  <th onClick={() => handleSort('cpp')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    CPP <SortIcon field="cpp" />
                  </th>
                  <th onClick={() => handleSort('active_ad_count')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    Ads <SortIcon field="active_ad_count" />
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {sortedData.map((item) => (
                  <tr key={item.concept_code} className={isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedConcepts.includes(item.concept_code)}
                        onChange={() => toggleConceptSelection(item.concept_code)}
                        className="w-4 h-4 text-cyan-600 rounded"
                      />
                    </td>
                    <td className={`px-4 py-3 text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                      {item.concept_code}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                      ${safeNumber(item.spend, 0)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                      ${safeNumber(item.revenue, 0)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${
                      item.roas >= 2.0 ? 'text-green-600' : 
                      item.roas >= 1.0 ? 'text-yellow-600' : 
                      'text-red-600'
                    }`}>
                      {safeNumber(item.roas, 2)}x
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {item.conversions}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      ${safeNumber(item.cpm, 2)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {safeNumber(item.ctr * 100, 2)}%
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      ${safeNumber(item.cpi, 2)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      ${safeNumber(item.cpp, 2)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <span className="font-medium">{item.active_ad_count}</span> / {item.ad_count}
                    </td>
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