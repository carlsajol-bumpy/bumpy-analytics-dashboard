'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function AnalyticsPage({ isDark }: { isDark?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [allData, setAllData] = useState<any[]>([])
  
  // Date range
  const [dateRange, setDateRange] = useState('last_7d')
  const [compareMode, setCompareMode] = useState(false)
  
  // Filters
  const [filters, setFilters] = useState({
    batch: 'All',
    week: 'All',
    persona: 'All',
    conceptCode: 'All',
    performanceCategory: 'All',
    status: 'All',
    searchQuery: ''
  })

  useEffect(() => {
    fetchData()
  }, [dateRange])

  useEffect(() => {
    if (allData.length > 0) {
      calculateAnalytics()
    }
  }, [filters, allData])

  async function fetchData() {
    setLoading(true)
    
    try {
      // Get ALL ads (ACTIVE + PAUSED) - no status filter
      const { data, error } = await supabase
        .from('creative_performance')
        .select('*')
        .order('batch', { ascending: true })

      if (error) {
        console.error('Error fetching analytics:', error)
        setLoading(false)
        return
      }

      if (data) {
        setAllData(data)
      }
    } catch (err) {
      console.error('Error:', err)
    }
    
    setLoading(false)
  }

  function extractWeekFromBatch(batch: string) {
    const match = batch?.match(/Week(\d+)/i)
    return match ? `Week${match[1]}` : batch
  }

  function calculateAnalytics() {
    // Filter data
    let filteredData = allData.filter(ad => {
      if (filters.batch !== 'All' && ad.batch !== filters.batch) return false
      if (filters.week !== 'All') {
        const adWeek = extractWeekFromBatch(ad.batch)
        if (adWeek !== filters.week) return false
      }
      if (filters.persona !== 'All' && ad.persona !== filters.persona) return false
      if (filters.conceptCode !== 'All' && ad.concept_code !== filters.conceptCode) return false
      if (filters.performanceCategory !== 'All' && ad.performance_category !== filters.performanceCategory) return false
      if (filters.status !== 'All' && ad.status !== filters.status) return false
      
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        return ad.ad_name?.toLowerCase().includes(query) ||
               ad.concept_code?.toLowerCase().includes(query) ||
               ad.persona?.toLowerCase().includes(query) ||
               ad.batch?.toLowerCase().includes(query)
      }
      
      return true
    })

    setAnalytics(filteredData)
  }

  const [analytics, setAnalytics] = useState<any[]>([])

  // Calculate totals
  const totals = analytics.reduce((acc, ad) => {
    const spend = parseFloat(ad.spend_7d || 0)
    const revenue = parseFloat(ad.roas_7d || 0) * spend
    
    acc.spend += spend
    acc.revenue += revenue
    acc.impressions += parseInt(ad.impressions_7d || 0)
    acc.clicks += parseInt(ad.clicks_7d || 0)
    acc.conversions += parseInt(ad.conversions_7d || 0)
    acc.count += 1
    return acc
  }, {
    spend: 0,
    revenue: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    count: 0
  })

  const overallRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0
  const overallCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) : 0
  const overallCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
  const overallCvr = totals.clicks > 0 ? totals.conversions / totals.clicks : 0
  const overallItp = totals.impressions > 0 ? totals.conversions / totals.impressions : 0
  const overallPp10k = totals.impressions > 0 ? (totals.conversions / totals.impressions) * 10000 : 0

  // Get unique values for filters
  const batches = ['All', ...new Set(allData.map(ad => ad.batch).filter(Boolean))].sort()
  const weeks = ['All', ...new Set(allData.map(ad => extractWeekFromBatch(ad.batch)).filter(Boolean))].sort()
  const personas = ['All', ...new Set(allData.map(ad => ad.persona).filter(Boolean))].sort()
  const conceptCodes = ['All', ...new Set(allData.map(ad => ad.concept_code).filter(Boolean))].sort()
  const performanceCategories = ['All', 'winning', 'contender', 'fatigued', 'not-spending', 'not-performing', 'paused', 'paused-winner', 'paused-fatigued']
  const statuses = ['All', 'ACTIVE', 'PAUSED']

  // Weekly trend data
  const weeklyData: any = {}
  analytics.forEach(ad => {
    const week = ad.batch || 'Unknown'
    if (!weeklyData[week]) {
      weeklyData[week] = {
        week: week,
        spend: 0,
        revenue: 0,
        conversions: 0,
        roas: 0
      }
    }
    const spend = parseFloat(ad.spend_7d || 0)
    const roas = parseFloat(ad.roas_7d || 0)
    
    weeklyData[week].spend += spend
    weeklyData[week].revenue += (roas * spend)
    weeklyData[week].conversions += parseInt(ad.conversions_7d || 0)
  })

  const weeklyTrend = Object.values(weeklyData)
    .map((w: any) => ({
      ...w,
      roas: w.spend > 0 ? w.revenue / w.spend : 0
    }))
    .sort((a: any, b: any) => a.week.localeCompare(b.week))
    .slice(-12)

  if (loading) {
    return (
      <div className={`rounded-xl p-12 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          <span className={`ml-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Loading analytics...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Date Range & Compare Mode */}
      <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Date Range</span>
            
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className={`px-4 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              <option value="last_7d">Last 7 Days</option>
              <option value="last_14d">Last 14 Days</option>
              <option value="last_30d">Last 30 Days</option>
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month</option>
            </select>
          </div>

          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              compareMode
                ? 'bg-cyan-600 text-white'
                : isDark 
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {compareMode ? 'Comparing...' : 'Compare vs Previous'}
            </div>
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Filters</h3>
        </div>

        <div className="grid grid-cols-7 gap-4 mb-4">
          {/* Status Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Batch Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Batch</label>
            <select
              value={filters.batch}
              onChange={(e) => setFilters({...filters, batch: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {batches.map(batch => <option key={batch} value={batch}>{batch}</option>)}
            </select>
          </div>

          {/* Week Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Week</label>
            <select
              value={filters.week}
              onChange={(e) => setFilters({...filters, week: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {weeks.map(week => <option key={week} value={week}>{week}</option>)}
            </select>
          </div>

          {/* Persona Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Persona</label>
            <select
              value={filters.persona}
              onChange={(e) => setFilters({...filters, persona: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {personas.map(persona => <option key={persona} value={persona}>{persona}</option>)}
            </select>
          </div>

          {/* Concept Code Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Concept</label>
            <select
              value={filters.conceptCode}
              onChange={(e) => setFilters({...filters, conceptCode: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {conceptCodes.map(code => <option key={code} value={code}>{code}</option>)}
            </select>
          </div>

          {/* Performance Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Performance</label>
            <select
              value={filters.performanceCategory}
              onChange={(e) => setFilters({...filters, performanceCategory: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {performanceCategories.map(cat => <option key={cat} value={cat}>{cat === 'All' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
            </select>
          </div>

          {/* Search Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Search</label>
            <input
              type="text"
              placeholder="Search..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({...filters, searchQuery: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Showing {totals.count} ads
          </div>
          <button
            onClick={() => setFilters({ batch: 'All', week: 'All', persona: 'All', conceptCode: 'All', performanceCategory: 'All', status: 'All', searchQuery: '' })}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Overview Stats - 5 Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Spend</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ${totals.spend.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Revenue</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ${totals.revenue.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Overall ROAS</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {overallRoas.toFixed(2)}x
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Conversions</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {totals.conversions.toLocaleString()}
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Ads</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {totals.count}
          </div>
        </div>
      </div>

      {/* Mid & Bottom Funnel Metrics */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Mid & Bottom Funnel Indicators
        </h3>
        <div className="grid grid-cols-5 gap-4">
          <div>
            <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>CTR</div>
            <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {(overallCtr * 100).toFixed(2)}%
            </div>
          </div>

          <div>
            <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>CPC</div>
            <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              ${overallCpc.toFixed(2)}
            </div>
          </div>

          <div>
            <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>CVR</div>
            <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {(overallCvr * 100).toFixed(2)}%
            </div>
          </div>

          <div>
            <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>ITP</div>
            <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {(overallItp * 100).toFixed(3)}%
            </div>
          </div>

          <div>
            <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>PP10K</div>
            <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {overallPp10k.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Trend Chart */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Performance Trend (Last 12 Weeks)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={weeklyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
            <XAxis dataKey="week" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
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
            <Line type="monotone" dataKey="spend" stroke="#06B6D4" strokeWidth={2} name="Spend ($)" />
            <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Revenue ($)" />
            <Line type="monotone" dataKey="conversions" stroke="#8B5CF6" strokeWidth={2} name="Conversions" />
            <Line type="monotone" dataKey="roas" stroke="#F59E0B" strokeWidth={2} name="ROAS" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}