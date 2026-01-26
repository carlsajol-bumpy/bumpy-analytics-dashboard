'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// Helper function to safely format numbers
function safeNumber(value: any, decimals: number = 2): string {
  const num = parseFloat(value)
  if (isNaN(num) || num === undefined || num === null) {
    return (0).toFixed(decimals)
  }
  return num.toFixed(decimals)
}

interface AdSetLevelViewProps {
  isDark?: boolean
}

export default function AdSetLevelView({ isDark }: AdSetLevelViewProps) {
  const [adsets, setAdsets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState('spend')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  // Filters
  const [filters, setFilters] = useState({
    device: 'All',
    country: 'All',
    status: 'All',
    campaign: 'All',
    dateRange: '7d' // '7d' = This Week, 'prev' = Previous Week
  })

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

      console.log('📊 Total ad sets fetched from adsets table:', adsetsData?.length)
      console.log('📊 Sample ad set:', adsetsData?.[0])

      if (!adsetsData || adsetsData.length === 0) {
        console.warn('No ad sets found in adsets table')
        setLoading(false)
        return
      }

      // Enrich ad sets with calculated metrics
      const enrichedAdSets = adsetsData.map((adset: any) => {
        const spend_7d = parseFloat(adset.spend_7d || 0)
        const revenue_7d = parseFloat(adset.revenue_7d || 0)
        const impressions_7d = parseInt(adset.impressions_7d || 0)
        const clicks_7d = parseInt(adset.clicks_7d || 0)
        const conversions_7d = parseInt(adset.conversions_7d || 0)
        
        const spend_prev = parseFloat(adset.spend_prev || 0)
        const revenue_prev = parseFloat(adset.revenue_prev || 0)
        const impressions_prev = parseInt(adset.impressions_prev || 0)
        const clicks_prev = parseInt(adset.clicks_prev || 0)
        const conversions_prev = parseInt(adset.conversions_prev || 0)
        
        return {
          ...adset,
          
          // This Week (7d) metrics
          spend_7d,
          revenue_7d,
          impressions_7d,
          clicks_7d,
          conversions_7d,
          roas_7d: spend_7d > 0 ? revenue_7d / spend_7d : 0,
          cpm_7d: impressions_7d > 0 ? (spend_7d / impressions_7d) * 1000 : 0,
          ctr_7d: impressions_7d > 0 ? (clicks_7d / impressions_7d) : 0,
          ipm_7d: impressions_7d / 1000,
          cpi_7d: conversions_7d > 0 ? spend_7d / conversions_7d : 0,
          cpc_7d: clicks_7d > 0 ? spend_7d / clicks_7d : 0,
          cpp_7d: conversions_7d > 0 ? spend_7d / conversions_7d : 0,
          cvr_7d: clicks_7d > 0 ? conversions_7d / clicks_7d : 0,
          pp10k_7d: impressions_7d > 0 ? (conversions_7d / impressions_7d) * 10000 : 0,
          avg_purchase_value_7d: conversions_7d > 0 ? revenue_7d / conversions_7d : 0,
          
          // Previous Week (prev) metrics
          spend_prev,
          revenue_prev,
          impressions_prev,
          clicks_prev,
          conversions_prev,
          roas_prev: spend_prev > 0 ? revenue_prev / spend_prev : 0,
          cpm_prev: impressions_prev > 0 ? (spend_prev / impressions_prev) * 1000 : 0,
          ctr_prev: impressions_prev > 0 ? (clicks_prev / impressions_prev) : 0,
          ipm_prev: impressions_prev / 1000,
          cpi_prev: conversions_prev > 0 ? spend_prev / conversions_prev : 0,
          cpc_prev: clicks_prev > 0 ? spend_prev / clicks_prev : 0,
          cpp_prev: conversions_prev > 0 ? spend_prev / conversions_prev : 0,
          cvr_prev: clicks_prev > 0 ? conversions_prev / clicks_prev : 0,
          pp10k_prev: impressions_prev > 0 ? (conversions_prev / impressions_prev) * 10000 : 0,
          avg_purchase_value_prev: conversions_prev > 0 ? revenue_prev / conversions_prev : 0,
          
          // Change metrics
          spend_change: spend_prev > 0 ? ((spend_7d - spend_prev) / spend_prev) * 100 : 0,
          revenue_change: revenue_prev > 0 ? ((revenue_7d - revenue_prev) / revenue_prev) * 100 : 0,
        }
      })

      console.log('📊 Enriched ad sets:', enrichedAdSets.length)
      setAdsets(enrichedAdSets)
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

  const filteredAdSets = adsets.filter(adset => {
    // Filter by Device (using primary_device directly from adset)
    if (filters.device !== 'All') {
      if (adset.primary_device !== filters.device) return false
    }
    
    // Filter by Country (using primary_country directly from adset)
    if (filters.country !== 'All') {
      if (adset.primary_country !== filters.country) return false
    }
    
    // Filter by Campaign
    if (filters.campaign !== 'All' && adset.campaign_name !== filters.campaign) return false
    
    // Filter by Status
    if (filters.status !== 'All' && adset.status !== filters.status) return false
    
    return true
  })

  // Helper function to get the correct metric based on selected date range
  const getMetric = (adset: any, baseMetric: string) => {
    const suffix = filters.dateRange === '7d' ? '_7d' : '_prev'
    return adset[baseMetric + suffix] || 0
  }

  const sortedAdSets = [...filteredAdSets].sort((a, b) => {
    const aVal = getMetric(a, sortField)
    const bVal = getMetric(b, sortField)
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    
    return sortDirection === 'asc' 
      ? String(aVal || '').localeCompare(String(bVal || ''))
      : String(bVal || '').localeCompare(String(aVal || ''))
  })

  const totals = filteredAdSets.reduce((acc, adset) => {
    acc.spend += getMetric(adset, 'spend')
    acc.revenue += getMetric(adset, 'revenue')
    acc.impressions += getMetric(adset, 'impressions')
    acc.clicks += getMetric(adset, 'clicks')
    acc.conversions += getMetric(adset, 'conversions')
    return acc
  }, { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 })

  const overallRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0
  const overallCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
  const overallCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) : 0
  const overallIpm = totals.impressions / 1000
  const overallCpi = totals.conversions > 0 ? totals.spend / totals.conversions : 0
  const overallCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
  const overallCpp = totals.conversions > 0 ? totals.spend / totals.conversions : 0
  const overallPp10k = totals.impressions > 0 ? (totals.conversions / totals.impressions) * 10000 : 0
  const overallAvgPurchaseValue = totals.conversions > 0 ? totals.revenue / totals.conversions : 0
  const overallSpendChange = filteredAdSets.reduce((sum, a) => sum + (a.spend_change || 0), 0) / (filteredAdSets.length || 1)

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
          {/* Date Range Filter - HIGHLIGHTED */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
               Date Range
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border-2 font-medium ${
                isDark 
                  ? 'bg-cyan-900/30 border-cyan-600 text-cyan-300' 
                  : 'bg-cyan-50 border-cyan-500 text-cyan-700'
              }`}
            >
              <option value="7d">This Week</option>
              <option value="prev">Previous Week</option>
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
            Showing {sortedAdSets.length} ad sets
            <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
              filters.dateRange === '7d'
                ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                : isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'
            }`}>
              {filters.dateRange === '7d' ? 'This Week' : 'Previous Week'}
            </span>
          </div>
          <button
            onClick={() => setFilters({ device: 'All', country: 'All', status: 'All', campaign: 'All', dateRange: '7d' })}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-8 gap-4">
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Spend</div>
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
        {/* Bar Chart - Week Comparison - ALWAYS SHOWS BOTH WEEKS */}
        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Performance: Current Week vs Previous Week
            </h3>
            {(filters.device !== 'All' || filters.country !== 'All' || filters.campaign !== 'All') && (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${isDark ? 'bg-cyan-900/30 text-cyan-400' : 'bg-cyan-50 text-cyan-700'}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Filters Active</span>
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              {
                metric: 'Spend',
                'Current Week': filteredAdSets.reduce((sum, a) => sum + (a.spend_7d || 0), 0),
                'Previous Week': filteredAdSets.reduce((sum, a) => sum + (a.spend_prev || 0), 0)
              },
              {
                metric: 'Revenue',
                'Current Week': filteredAdSets.reduce((sum, a) => sum + (a.revenue_7d || 0), 0),
                'Previous Week': filteredAdSets.reduce((sum, a) => sum + (a.revenue_prev || 0), 0)
              },
              {
                metric: 'Conversions',
                'Current Week': filteredAdSets.reduce((sum, a) => sum + (a.conversions_7d || 0), 0),
                'Previous Week': filteredAdSets.reduce((sum, a) => sum + (a.conversions_prev || 0), 0)
              },
              {
                metric: 'ROAS',
                'Current Week': filteredAdSets.reduce((sum, a) => sum + (a.roas_7d || 0), 0) / (filteredAdSets.length || 1),
                'Previous Week': filteredAdSets.reduce((sum, a) => sum + (a.roas_prev || 0), 0) / (filteredAdSets.length || 1)
              }
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
              <XAxis dataKey="metric" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
              <YAxis stroke={isDark ? '#9CA3AF' : '#6B7280'} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                  border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                  borderRadius: '8px'
                }}
                labelStyle={{ color: isDark ? '#F3F4F6' : '#111827' }}
              />
              <Legend />
              <Bar dataKey="Current Week" fill="#06B6D4" />
              <Bar dataKey="Previous Week" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
          <div className={`mt-4 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
             Tip: This chart always shows both weeks for comparison
          </div>
        </div>

        {/* Pie Chart - Ad Set Distribution by Performance */}
        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Spend Distribution by Ad Set (Top 5)
            <span className={`ml-2 text-sm font-normal ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              - {filters.dateRange === '7d' ? 'This Week' : 'Previous Week'}
            </span>
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={sortedAdSets.slice(0, 5).map(adset => ({
                  name: adset.adset_name.length > 20 ? adset.adset_name.substring(0, 20) + '...' : adset.adset_name,
                  fullName: adset.adset_name,
                  value: getMetric(adset, 'spend')
                }))}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                cursor="pointer"
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
          <div className={`mt-4 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
             Tip: This chart updates based on your selected date range
          </div>
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
                  Spend <SortIcon field="spend" />
                </th>
                <th onClick={() => handleSort('spend_change')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Change <SortIcon field="spend_change" />
                </th>
                <th onClick={() => handleSort('revenue')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Value <SortIcon field="revenue" />
                </th>
                <th onClick={() => handleSort('cpm')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  CPM <SortIcon field="cpm" />
                </th>
                <th onClick={() => handleSort('ctr')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  CTR <SortIcon field="ctr" />
                </th>
                <th onClick={() => handleSort('ipm')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  IPM <SortIcon field="ipm" />
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
                <th onClick={() => handleSort('cpp')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  CPP <SortIcon field="cpp" />
                </th>
                <th onClick={() => handleSort('roas')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  ROAS <SortIcon field="roas" />
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {sortedAdSets.map((adset) => {
                const spend = getMetric(adset, 'spend')
                const revenue = getMetric(adset, 'revenue')
                const cpm = getMetric(adset, 'cpm')
                const ctr = getMetric(adset, 'ctr')
                const ipm = getMetric(adset, 'ipm')
                const conversions = getMetric(adset, 'conversions')
                const cpi = getMetric(adset, 'cpi')
                const pp10k = getMetric(adset, 'pp10k')
                const avgPurchaseValue = getMetric(adset, 'avg_purchase_value')
                const cpp = getMetric(adset, 'cpp')
                const roas = getMetric(adset, 'roas')
                
                return (
                  <tr key={adset.adset_id} className={isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}>
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
                      ${safeNumber(spend, 0)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${
                      adset.spend_change > 0 ? 'text-green-600' : 
                      adset.spend_change < 0 ? 'text-red-600' : 
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {adset.spend_change > 0 ? '+' : ''}{safeNumber(adset.spend_change, 1)}%
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                      ${safeNumber(revenue, 0)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      ${safeNumber(cpm, 2)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {safeNumber(ctr * 100, 2)}%
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {safeNumber(ipm, 1)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {conversions}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      ${safeNumber(cpi, 2)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {safeNumber(pp10k, 1)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      ${safeNumber(avgPurchaseValue, 2)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      ${safeNumber(cpp, 2)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${
                      roas >= 2.0 ? 'text-green-600' : 
                      roas >= 1.0 ? 'text-yellow-600' : 
                      'text-red-600'
                    }`}>
                      {safeNumber(roas, 2)}x
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Summary Footer Row */}
            <tfoot className={`${isDark ? 'bg-cyan-900/20 border-t-2 border-cyan-600' : 'bg-cyan-50 border-t-2 border-cyan-500'}`}>
              <tr>
                <td colSpan={4} className={`px-4 py-4 text-sm font-bold ${isDark ? 'text-cyan-300' : 'text-cyan-900'}`}>
                   TOTALS ({sortedAdSets.length} ad sets)
                </td>
                <td className={`px-4 py-4 text-sm text-right font-bold ${isDark ? 'text-cyan-200' : 'text-cyan-900'}`}>
                  ${safeNumber(totals.spend, 0)}
                </td>
                <td className={`px-4 py-4 text-sm text-right font-medium ${
                  overallSpendChange > 0 ? 'text-green-600' : 
                  overallSpendChange < 0 ? 'text-red-600' : 
                  isDark ? 'text-cyan-300' : 'text-cyan-700'
                }`}>
                  {overallSpendChange > 0 ? '+' : ''}{safeNumber(overallSpendChange, 1)}%
                </td>
                <td className={`px-4 py-4 text-sm text-right font-bold ${isDark ? 'text-cyan-200' : 'text-cyan-900'}`}>
                  ${safeNumber(totals.revenue, 0)}
                </td>
                <td className={`px-4 py-4 text-sm text-right font-medium ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                  ${safeNumber(overallCpm, 2)}
                </td>
                <td className={`px-4 py-4 text-sm text-right font-medium ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                  {safeNumber(overallCtr * 100, 2)}%
                </td>
                <td className={`px-4 py-4 text-sm text-right font-medium ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                  {safeNumber(overallIpm, 1)}
                </td>
                <td className={`px-4 py-4 text-sm text-right font-bold ${isDark ? 'text-cyan-200' : 'text-cyan-900'}`}>
                  {totals.conversions}
                </td>
                <td className={`px-4 py-4 text-sm text-right font-medium ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                  ${safeNumber(overallCpi, 2)}
                </td>
                <td className={`px-4 py-4 text-sm text-right font-medium ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                  {safeNumber(overallPp10k, 1)}
                </td>
                <td className={`px-4 py-4 text-sm text-right font-medium ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                  ${safeNumber(overallAvgPurchaseValue, 2)}
                </td>
                <td className={`px-4 py-4 text-sm text-right font-medium ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                  ${safeNumber(overallCpp, 2)}
                </td>
                <td className={`px-4 py-4 text-sm text-right font-bold ${
                  overallRoas >= 2.0 ? 'text-green-600' : 
                  overallRoas >= 1.0 ? 'text-yellow-600' : 
                  'text-red-600'
                }`}>
                  {safeNumber(overallRoas, 2)}x
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}