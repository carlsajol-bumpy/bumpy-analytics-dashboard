'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function AnalyticsPage({ isDark }: { isDark?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [allData, setAllData] = useState<any[]>([])
  
  // Filters
  const [filters, setFilters] = useState({
    batch: 'All',
    persona: 'All',
    conceptCode: 'All',
    performanceCategory: 'All',
    searchQuery: ''
  })
  
  // Analytics data
  const [analytics, setAnalytics] = useState<{
    overview: { totalSpend: number, totalRevenue: number, avgRoas: number, totalConversions: number, activeAds: number },
    weeklyTrend: any[],
    topPerformers: any[],
    batchComparison: any[]
  }>({
    overview: { totalSpend: 0, totalRevenue: 0, avgRoas: 0, totalConversions: 0, activeAds: 0 },
    weeklyTrend: [],
    topPerformers: [],
    batchComparison: []
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (allData.length > 0) {
      calculateAnalytics()
    }
  }, [filters, allData])

  async function fetchData() {
    setLoading(true)
    
    try {
      const { data, error } = await supabase
        .from('creative_performance')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('batch', { ascending: true })

      if (error) {
        console.error('Error fetching data:', error)
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

  function calculateAnalytics() {
    // Filter data based on selected filters
    let filteredData = allData.filter(ad => {
      if (filters.batch !== 'All' && ad.batch !== filters.batch) return false
      if (filters.persona !== 'All' && ad.persona !== filters.persona) return false
      if (filters.conceptCode !== 'All' && ad.concept_code !== filters.conceptCode) return false
      if (filters.performanceCategory !== 'All' && ad.performance_category !== filters.performanceCategory) return false
      
      // Search filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        const matchesAdName = ad.ad_name?.toLowerCase().includes(query)
        const matchesConceptCode = ad.concept_code?.toLowerCase().includes(query)
        const matchesPersona = ad.persona?.toLowerCase().includes(query)
        const matchesBatch = ad.batch?.toLowerCase().includes(query)
        
        if (!matchesAdName && !matchesConceptCode && !matchesPersona && !matchesBatch) return false
      }
      
      return true
    })

    // Calculate overview metrics
    const totalSpend = filteredData.reduce((sum, ad) => sum + parseFloat(ad.spend_7d || 0), 0)
    const totalConversions = filteredData.reduce((sum, ad) => sum + parseInt(ad.conversions_7d || 0), 0)
    const totalRevenue = filteredData.reduce((sum, ad) => {
      const roas = parseFloat(ad.roas_7d || 0)
      const spend = parseFloat(ad.spend_7d || 0)
      return sum + (roas * spend)
    }, 0)
    const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0

    // Weekly trend (group by batch/week)
    const weeklyData: any = {}
    filteredData.forEach(ad => {
      const week = ad.batch || 'Unknown'
      if (!weeklyData[week]) {
        weeklyData[week] = {
          week: week,
          spend: 0,
          revenue: 0,
          conversions: 0,
          ads: 0
        }
      }
      const spend = parseFloat(ad.spend_7d || 0)
      const roas = parseFloat(ad.roas_7d || 0)
      
      weeklyData[week].spend += spend
      weeklyData[week].revenue += (roas * spend)
      weeklyData[week].conversions += parseInt(ad.conversions_7d || 0)
      weeklyData[week].ads += 1
    })

    const weeklyTrend = Object.values(weeklyData)
      .sort((a: any, b: any) => a.week.localeCompare(b.week))
      .slice(-12) // Show last 12 weeks only

    // Top performers
    const topPerformers = [...filteredData]
      .filter(ad => parseFloat(ad.roas_7d || 0) > 0)
      .sort((a, b) => parseFloat(b.roas_7d || 0) - parseFloat(a.roas_7d || 0))
      .slice(0, 10)

    // Batch comparison (compare all batches side by side)
    const batchData: any = {}
    filteredData.forEach(ad => {
      const batch = ad.batch || 'Unknown'
      if (!batchData[batch]) {
        batchData[batch] = {
          batch: batch,
          ads: 0,
          spend: 0,
          conversions: 0,
          avgRoas: 0,
          roasSum: 0
        }
      }
      batchData[batch].ads += 1
      batchData[batch].spend += parseFloat(ad.spend_7d || 0)
      batchData[batch].conversions += parseInt(ad.conversions_7d || 0)
      batchData[batch].roasSum += parseFloat(ad.roas_7d || 0)
    })

    const batchComparison = Object.values(batchData)
      .map((b: any) => ({
        ...b,
        avgRoas: b.ads > 0 ? b.roasSum / b.ads : 0,
        cpa: b.conversions > 0 ? b.spend / b.conversions : 0
      }))
      .sort((a: any, b: any) => b.spend - a.spend)
      .slice(0, 10) // Top 10 batches by spend

    setAnalytics({
      overview: {
        totalSpend,
        totalRevenue,
        avgRoas,
        totalConversions,
        activeAds: filteredData.length
      },
      weeklyTrend,
      topPerformers,
      batchComparison
    })
  }

  // Get unique values for filters
  const batches = ['All', ...new Set(allData.map(ad => ad.batch).filter(Boolean))].sort()
  const personas = ['All', ...new Set(allData.map(ad => ad.persona).filter(Boolean))].sort()
  const conceptCodes = ['All', ...new Set(allData.map(ad => ad.concept_code).filter(Boolean))].sort()
  const performanceCategories = ['All', 'winning', 'contender', 'fatigued', 'not-performing']

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
      {/* Filters Section */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Filters</h3>
        </div>

        <div className="grid grid-cols-5 gap-4 mb-4">
          {/* Batch Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Batch / Week
            </label>
            <select
              value={filters.batch}
              onChange={(e) => setFilters({...filters, batch: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              {batches.map(batch => (
                <option key={batch} value={batch}>{batch}</option>
              ))}
            </select>
          </div>

          {/* Persona Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Persona
            </label>
            <select
              value={filters.persona}
              onChange={(e) => setFilters({...filters, persona: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              {personas.map(persona => (
                <option key={persona} value={persona}>{persona}</option>
              ))}
            </select>
          </div>

          {/* Concept Code Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Concept Code
            </label>
            <select
              value={filters.conceptCode}
              onChange={(e) => setFilters({...filters, conceptCode: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              {conceptCodes.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          {/* Performance Category Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Performance
            </label>
            <select
              value={filters.performanceCategory}
              onChange={(e) => setFilters({...filters, performanceCategory: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              {performanceCategories.map(cat => (
                <option key={cat} value={cat}>{cat === 'All' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Search Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Search
            </label>
            <input
              type="text"
              placeholder="Search ads..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({...filters, searchQuery: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        <div className="flex items-center justify-between">
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Showing {analytics.overview.activeAds} ads
          </div>
          <button
            onClick={() => setFilters({
              batch: 'All',
              persona: 'All',
              conceptCode: 'All',
              performanceCategory: 'All',
              searchQuery: ''
            })}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              isDark 
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Spend</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ${analytics.overview.totalSpend.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Revenue</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ${analytics.overview.totalRevenue.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Avg ROAS</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {analytics.overview.avgRoas.toFixed(2)}x
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Conversions</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {analytics.overview.totalConversions.toLocaleString()}
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Active Ads</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {analytics.overview.activeAds}
          </div>
        </div>
      </div>

      {/* Weekly Trend Chart */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Performance Trend (Last 12 Weeks)
          </h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics.weeklyTrend}>
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
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Batch Comparison Table */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Batch Performance Comparison (Top 10)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={isDark ? 'bg-gray-750' : 'bg-gray-50'}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Batch</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Ads</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Spend</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Conversions</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Avg ROAS</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>CPA</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {analytics.batchComparison.map((batch: any, index: number) => (
                <tr key={index} className={isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}>
                  <td className={`px-4 py-3 text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    {batch.batch}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {batch.ads}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    ${batch.spend.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {batch.conversions}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${
                    batch.avgRoas >= 2.0 ? 'text-green-600' : 
                    batch.avgRoas >= 1.0 ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}>
                    {batch.avgRoas.toFixed(2)}x
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    ${batch.cpa.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Performers */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Top 10 Performers by ROAS
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {analytics.topPerformers.map((ad: any, index: number) => (
            <div key={index} className={`p-4 rounded-lg border ${isDark ? 'bg-gray-750 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate mb-1 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    {ad.ad_name}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-cyan-600 text-white font-medium">
                      {ad.concept_code}
                    </span>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {ad.persona}
                    </span>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {ad.batch}
                    </span>
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="text-lg font-bold text-green-600">
                    {parseFloat(ad.roas_7d).toFixed(2)}x
                  </div>
                  <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    ${parseFloat(ad.spend_7d).toFixed(0)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}