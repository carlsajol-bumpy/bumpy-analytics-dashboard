'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { exportToCSV } from '../lib/csvExport'

// Helper function to safely format numbers
function safeNumber(value: any, decimals: number = 2): string {
  const num = parseFloat(value)
  if (isNaN(num) || num === undefined || num === null) {
    return (0).toFixed(decimals)
  }
  return num.toFixed(decimals)
}

// Column mapping for different timeframes
const TIMEFRAME_COLUMNS: Record<string, string> = {
  '7d': '_7d',      // Uses spend_7d, revenue_7d, etc.
  '14d': '_prev',   // Uses spend_prev, revenue_prev, etc. (14d data is in prev columns)
  '28d': '_28d',    // Uses spend_28d, revenue_28d, etc.
  '30d': '_30d'     // Uses spend_30d, revenue_30d, etc.
}

interface AdSetLevelViewProps {
  isDark?: boolean
}

export default function AdSetLevelView({ isDark }: AdSetLevelViewProps) {
  const [adsets, setAdsets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState('spend')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  // Filters - REMOVED persona and concept
  const [filters, setFilters] = useState({
    device: 'All',
    country: 'All',
    status: 'All',
    campaign: 'All',
    timeframe: '7d'
  })

  // CSV Export Function
  const handleExportCSV = () => {
    const timeframeLabel = filters.timeframe
    const filename = `ad_sets_${timeframeLabel}${filters.campaign !== 'All' ? `_${filters.campaign}` : ''}${filters.status !== 'All' ? `_${filters.status}` : ''}`
    
    exportToCSV(
      sortedAdSets,
      filename,
      [
        { key: 'adset_name', label: 'Ad Set Name' },
        { key: 'campaign_name', label: 'Campaign' },
        { key: 'primary_device', label: 'Device' },
        { key: 'primary_country', label: 'Country' },
        { key: 'status', label: 'Status' },
        { key: 'spend', label: `Spend ${timeframeLabel} ($)` },
        { key: 'revenue', label: `Revenue ${timeframeLabel} ($)` },
        { key: 'roas', label: `ROAS ${timeframeLabel}` },
        { key: 'cpm', label: `CPM ${timeframeLabel} ($)` },
        { key: 'ctr', label: `CTR ${timeframeLabel}` },
        { key: 'ipm', label: `IPM ${timeframeLabel}` },
        { key: 'conversions', label: `Installs ${timeframeLabel}` },
        { key: 'cpi', label: `CPI ${timeframeLabel} ($)` },
        { key: 'pp10k', label: `PP10K ${timeframeLabel}` },
        { key: 'avg_purchase_value', label: `Avg Purchase ${timeframeLabel} ($)` },
        { key: 'cpp', label: `CPP ${timeframeLabel} ($)` }
      ]
    )
  }

  useEffect(() => {
    fetchAdSets()
  }, [])

  async function fetchAdSets() {
    setLoading(true)
    
    try {
      // Fetch directly from adsets table (pre-aggregated data)
      const { data: adsetsData, error: adsetsError } = await supabase
        .from('adsets')
        .select('*')
        .limit(1000)

      if (adsetsError) {
        console.error('Error fetching ad sets from adsets table:', adsetsError)
        setLoading(false)
        return
      }

      console.log(' Total ad sets fetched from adsets table:', adsetsData?.length)
      console.log(' Sample ad set columns:', Object.keys(adsetsData?.[0] || {}))

      if (!adsetsData || adsetsData.length === 0) {
        console.warn('No ad sets found in adsets table')
        setLoading(false)
        return
      }

      // Enrich ad sets with ALL timeframes
      const enrichedAdSets = adsetsData.map((adset: any) => {
        const result: any = { ...adset }

        // Calculate metrics for each timeframe
        const timeframeMappings = [
          { label: '7d', suffix: '_7d' },
          { label: '14d', suffix: '_prev' },    // 14d uses _prev columns
          { label: '28d', suffix: '_28d' },
          { label: '30d', suffix: '_30d' }
        ]

        timeframeMappings.forEach(({ label, suffix }) => {
          const spend = parseFloat(adset[`spend${suffix}`] || 0)
          const revenue = parseFloat(adset[`revenue${suffix}`] || 0)
          const impressions = parseInt(adset[`impressions${suffix}`] || 0)
          const clicks = parseInt(adset[`clicks${suffix}`] || 0)
          const conversions = parseInt(adset[`conversions${suffix}`] || 0)

          result[`spend${suffix}`] = spend
          result[`revenue${suffix}`] = revenue
          result[`impressions${suffix}`] = impressions
          result[`clicks${suffix}`] = clicks
          result[`conversions${suffix}`] = conversions
          result[`roas${suffix}`] = spend > 0 ? revenue / spend : 0
          result[`cpm${suffix}`] = impressions > 0 ? (spend / impressions) * 1000 : 0
          result[`ctr${suffix}`] = impressions > 0 ? (clicks / impressions) : 0
          result[`ipm${suffix}`] = impressions / 1000
          result[`cpi${suffix}`] = conversions > 0 ? spend / conversions : 0
          result[`cpc${suffix}`] = clicks > 0 ? spend / clicks : 0
          result[`cpp${suffix}`] = conversions > 0 ? spend / conversions : 0
          result[`cvr${suffix}`] = clicks > 0 ? conversions / clicks : 0
          result[`pp10k${suffix}`] = impressions > 0 ? (conversions / impressions) * 10000 : 0
          result[`avg_purchase_value${suffix}`] = conversions > 0 ? revenue / conversions : 0
        })

        return result
      })

      console.log(' Enriched ad sets with all timeframes:', enrichedAdSets.length)
      console.log(' Sample ad set data:', {
        name: enrichedAdSets[0]?.adset_name,
        spend_7d: enrichedAdSets[0]?.spend_7d,
        spend_prev: enrichedAdSets[0]?.spend_prev,
        spend_28d: enrichedAdSets[0]?.spend_28d,
        spend_30d: enrichedAdSets[0]?.spend_30d
      })
      setAdsets(enrichedAdSets)
    } catch (err) {
      console.error('Error fetching data:', err)
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

  // Get column suffix for current timeframe
  const getColumnSuffix = () => TIMEFRAME_COLUMNS[filters.timeframe]

  const filteredAdSets = adsets.filter(adset => {
    if (filters.device !== 'All' && adset.primary_device !== filters.device) return false
    if (filters.country !== 'All' && adset.primary_country !== filters.country) return false
    if (filters.campaign !== 'All' && adset.campaign_name !== filters.campaign) return false
    if (filters.status !== 'All' && adset.status !== filters.status) return false
    
    return true
  })

  // Add current timeframe data to each item for sorting and display
  const enrichedFilteredData = filteredAdSets.map(adset => {
    const suffix = getColumnSuffix()
    return {
      ...adset,
      spend: adset[`spend${suffix}`],
      revenue: adset[`revenue${suffix}`],
      roas: adset[`roas${suffix}`],
      conversions: adset[`conversions${suffix}`],
      impressions: adset[`impressions${suffix}`],
      clicks: adset[`clicks${suffix}`],
      cpm: adset[`cpm${suffix}`],
      ctr: adset[`ctr${suffix}`],
      ipm: adset[`ipm${suffix}`],
      cpi: adset[`cpi${suffix}`],
      cpp: adset[`cpp${suffix}`],
      pp10k: adset[`pp10k${suffix}`],
      avg_purchase_value: adset[`avg_purchase_value${suffix}`]
    }
  })

  const sortedAdSets = [...enrichedFilteredData].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    
    return sortDirection === 'asc' 
      ? String(aVal || '').localeCompare(String(bVal || ''))
      : String(bVal || '').localeCompare(String(aVal || ''))
  })

  const totals = enrichedFilteredData.reduce((acc, adset) => {
    acc.spend += adset.spend || 0
    acc.revenue += adset.revenue || 0
    acc.impressions += adset.impressions || 0
    acc.clicks += adset.clicks || 0
    acc.conversions += adset.conversions || 0
    return acc
  }, { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 })

  const overallRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0
  const overallCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
  const overallCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) : 0
  const overallIpm = totals.impressions / 1000
  const overallCpi = totals.conversions > 0 ? totals.spend / totals.conversions : 0
  const overallPp10k = totals.impressions > 0 ? (totals.conversions / totals.impressions) * 10000 : 0

  const deviceOptions = ['All', ...new Set(adsets.map((adset: any) => adset.primary_device).filter(Boolean))].sort()
  const countryOptions = ['All', ...new Set(adsets.map((adset: any) => adset.primary_country).filter(Boolean))].sort()
  const campaignOptions = ['All', ...new Set(adsets.map(a => a.campaign_name).filter(Boolean))].sort()
  const statusOptions = ['All', 'ACTIVE', 'PAUSED']

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
          <span className={`ml-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Loading ad sets...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
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
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Campaign</label>
            <select
              value={filters.campaign}
              onChange={(e) => setFilters({...filters, campaign: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {campaignOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>OS / Device</label>
            <select
              value={filters.device}
              onChange={(e) => setFilters({...filters, device: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {deviceOptions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Country / Region</label>
            <select
              value={filters.country}
              onChange={(e) => setFilters({...filters, country: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Showing {sortedAdSets.length} ad sets ({filters.timeframe})
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
              onClick={() => setFilters({ device: 'All', country: 'All', status: 'All', campaign: 'All', timeframe: '7d' })}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-8 gap-4">
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Spend ({filters.timeframe})</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ${safeNumber(totals.spend / 1000, 1)}K
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Purchase Value</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ${safeNumber(totals.revenue / 1000, 1)}K
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>CPM</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ${safeNumber(overallCpm, 2)}
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>CTR</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {safeNumber(overallCtr * 100, 2)}%
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>IPM</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {safeNumber(overallIpm, 1)}
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>CPI</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ${safeNumber(overallCpi, 2)}
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>PP10K</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {safeNumber(overallPp10k, 1)}
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Purchase ROAS</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {safeNumber(overallRoas, 2)}x
          </div>
        </div>
      </div>

      {/* Performance Comparison Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Top Ad Sets by Spend ({filters.timeframe})
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sortedAdSets.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
              <XAxis 
                dataKey="adset_name" 
                stroke={isDark ? '#9CA3AF' : '#6B7280'}
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
                tick={{ fontSize: 10 }}
              />
              <YAxis stroke={isDark ? '#9CA3AF' : '#6B7280'} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                  border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="spend" fill="#06B6D4" name="Spend ($)" />
              <Bar dataKey="roas" fill="#10B981" name="ROAS" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Spend Distribution (Top 5) - {filters.timeframe}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={sortedAdSets.slice(0, 5).map(adset => ({
                  name: adset.adset_name?.length > 20 ? adset.adset_name.substring(0, 20) + '...' : adset.adset_name,
                  value: adset.spend
                }))}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.name}: ${(entry.percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {sortedAdSets.slice(0, 5).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#06B6D4', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'][index % 5]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                  border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                  borderRadius: '8px'
                }}
                formatter={(value: any) => `$${safeNumber(value, 0)}`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ad Sets Table */}
      <div className={`rounded-xl overflow-hidden shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={isDark ? 'bg-gray-750' : 'bg-gray-50'}>
              <tr>
                <th onClick={() => handleSort('adset_name')} className={`px-4 py-3 text-left text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Ad Set <SortIcon field="adset_name" />
                </th>
                <th onClick={() => handleSort('campaign_name')} className={`px-4 py-3 text-left text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Campaign <SortIcon field="campaign_name" />
                </th>
                <th onClick={() => handleSort('primary_device')} className={`px-4 py-3 text-left text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Device <SortIcon field="primary_device" />
                </th>
                <th onClick={() => handleSort('primary_country')} className={`px-4 py-3 text-left text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Country <SortIcon field="primary_country" />
                </th>
                <th onClick={() => handleSort('spend')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Spend ({filters.timeframe}) <SortIcon field="spend" />
                </th>
                <th onClick={() => handleSort('revenue')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Value <SortIcon field="revenue" />
                </th>
                <th onClick={() => handleSort('roas')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  ROAS <SortIcon field="roas" />
                </th>
                <th onClick={() => handleSort('cpm')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  CPM <SortIcon field="cpm" />
                </th>
                <th onClick={() => handleSort('ctr')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  CTR <SortIcon field="ctr" />
                </th>
                <th onClick={() => handleSort('conversions')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Installs <SortIcon field="conversions" />
                </th>
                <th onClick={() => handleSort('cpi')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  CPI <SortIcon field="cpi" />
                </th>
                <th onClick={() => handleSort('pp10k')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  PP10K <SortIcon field="pp10k" />
                </th>
                <th onClick={() => handleSort('avg_purchase_value')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Avg Purchase <SortIcon field="avg_purchase_value" />
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {sortedAdSets.map((adset) => (
                <tr key={adset.adset_id || adset.id} className={isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}>
                  <td className={`px-4 py-3 text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    {adset.adset_name || adset.name || 'Unknown'}
                  </td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {adset.campaign_name || 'Unknown'}
                  </td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      adset.primary_device === 'iOS' ? 'bg-gray-700 text-gray-200' : 
                      adset.primary_device === 'Android' ? 'bg-green-700 text-green-200' : 
                      'bg-blue-700 text-blue-200'
                    }`}>
                      {adset.primary_device || 'Unknown'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {adset.primary_country || 'Unknown'}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    ${safeNumber(adset.spend, 0)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    ${safeNumber(adset.revenue, 0)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${
                    adset.roas >= 2.0 ? 'text-green-600' : 
                    adset.roas >= 1.0 ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}>
                    {safeNumber(adset.roas, 2)}x
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    ${safeNumber(adset.cpm, 2)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {safeNumber(adset.ctr * 100, 2)}%
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {adset.conversions || 0}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    ${safeNumber(adset.cpi, 2)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {safeNumber(adset.pp10k, 1)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    ${safeNumber(adset.avg_purchase_value, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}