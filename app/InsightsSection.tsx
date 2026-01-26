'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface InsightsSectionProps {
  isDark?: boolean
}

export default function InsightsSection({ isDark }: InsightsSectionProps) {
  const [ads, setAds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAds()
  }, [])

  async function fetchAds() {
    setLoading(true)
    setError(null)
    
    try {
      // Get ALL ads - explicitly set high limit
      const { data, error: fetchError, count } = await supabase
        .from('creative_performance')
        .select('*', { count: 'exact' })
        .order('roas_7d', { ascending: false })
        .limit(10000)

      console.log('💡 Insights: Fetched', data?.length, 'ads. Total in DB:', count)

      if (fetchError) {
        console.error('Error fetching ads:', fetchError)
        setError(fetchError.message)
        setAds([])
      } else {
        setAds(data || [])
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Failed to fetch data')
      setAds([])
    }
    
    setLoading(false)
  }

  // Calculate insights safely
  const activeAds = (ads || []).filter(ad => ad.status === 'ACTIVE')
  const pausedAds = (ads || []).filter(ad => ad.status === 'PAUSED')
  const winningAds = (ads || []).filter(ad => ad.performance_category === 'winning')
  const fatigued = (ads || []).filter(ad => ad.performance_category === 'fatigued')
  const contenders = (ads || []).filter(ad => ad.performance_category === 'contender')
  const notSpending = (ads || []).filter(ad => ad.performance_category === 'not-spending')

  const totalSpend = (ads || []).reduce((sum, ad) => sum + parseFloat(ad.spend_7d || 0), 0)
  const totalRevenue = (ads || []).reduce((sum, ad) => {
    const roas = parseFloat(ad.roas_7d || 0)
    const spend = parseFloat(ad.spend_7d || 0)
    return sum + (roas * spend)
  }, 0)
  const totalConversions = (ads || []).reduce((sum, ad) => sum + parseInt(ad.conversions_7d || 0), 0)
  const totalClicks = (ads || []).reduce((sum, ad) => sum + parseInt(ad.clicks_7d || 0), 0)
  const totalImpressions = (ads || []).reduce((sum, ad) => sum + parseInt(ad.impressions_7d || 0), 0)
  
  const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0

  if (loading) {
    return (
      <div className={`rounded-xl p-12 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          <span className={`ml-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Loading insights...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`rounded-xl p-12 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Error Loading Data</h3>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{error}</p>
          <button
            onClick={fetchAds}
            className="mt-4 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!ads || ads.length === 0) {
    return (
      <div className={`rounded-xl p-12 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>No Data Available</h3>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Run your n8n workflow to populate the database with ad data.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-100 rounded-lg">
              <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div>
              <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Ads</div>
              <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{ads.length}</div>
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Spend</div>
              <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ${totalSpend.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
              </div>
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Avg ROAS</div>
              <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {avgRoas.toFixed(2)}x
              </div>
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Conversions</div>
              <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {totalConversions.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <div>
              <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Avg CTR</div>
              <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {avgCtr.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ad Status Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Ad Status</h3>
            <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Active</span>
              </div>
              <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{activeAds.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Paused</span>
              </div>
              <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{pausedAds.length}</span>
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Key Metrics</h3>
            <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Avg CPC</span>
              <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>${avgCpc.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Revenue</span>
              <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ${totalRevenue.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Breakdown */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Performance Distribution</h3>
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {ads.length} Total Ads
          </span>
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          {/* Winning */}
          <div className={`p-4 rounded-lg border-2 border-green-200 ${isDark ? 'bg-green-900/20' : 'bg-green-50'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <div className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Winning</div>
                <div className="text-2xl font-bold text-green-600">{winningAds.length}</div>
              </div>
            </div>
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {ads.length > 0 ? ((winningAds.length / ads.length) * 100).toFixed(1) : 0}% of total
            </div>
          </div>

          {/* Contenders */}
          <div className={`p-4 rounded-lg border-2 border-blue-200 ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <div className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Contenders</div>
                <div className="text-2xl font-bold text-blue-600">{contenders.length}</div>
              </div>
            </div>
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {ads.length > 0 ? ((contenders.length / ads.length) * 100).toFixed(1) : 0}% of total
            </div>
          </div>

          {/* Fatigued */}
          <div className={`p-4 rounded-lg border-2 border-orange-200 ${isDark ? 'bg-orange-900/20' : 'bg-orange-50'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Fatigued</div>
                <div className="text-2xl font-bold text-orange-600">{fatigued.length}</div>
              </div>
            </div>
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {ads.length > 0 ? ((fatigued.length / ads.length) * 100).toFixed(1) : 0}% of total
            </div>
          </div>

          {/* Not Spending */}
          <div className={`p-4 rounded-lg border-2 border-red-200 ${isDark ? 'bg-red-900/20' : 'bg-red-50'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <div className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Not Spending</div>
                <div className="text-2xl font-bold text-red-600">{notSpending.length}</div>
              </div>
            </div>
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {ads.length > 0 ? ((notSpending.length / ads.length) * 100).toFixed(1) : 0}% of total
            </div>
          </div>
        </div>
      </div>

      {/* Top Performing Ads */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Top 10 Performing Ads (by ROAS)
          </h3>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={isDark ? 'bg-gray-750' : 'bg-gray-50'}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Status</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Concept</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Persona</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Batch</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Spend</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>ROAS</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>CTR</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Category</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {ads.slice(0, 10).map((ad) => (
                <tr key={ad.ad_id} className={isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}>
                  <td className={`px-4 py-3 text-sm`}>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      ad.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {ad.status}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    {ad.concept_code || 'Unknown'}
                  </td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {ad.persona || 'Unknown'}
                  </td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {ad.batch || 'Unknown'}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    ${parseFloat(ad.spend_7d || 0).toFixed(0)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${
                    parseFloat(ad.roas_7d) >= 2.0 ? 'text-green-600' : 
                    parseFloat(ad.roas_7d) >= 1.0 ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}>
                    {parseFloat(ad.roas_7d || 0).toFixed(2)}x
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {(parseFloat(ad.ctr_7d || 0) * 100).toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      ad.performance_category === 'winning' ? 'bg-green-100 text-green-700' :
                      ad.performance_category === 'contender' ? 'bg-blue-100 text-blue-700' :
                      ad.performance_category === 'fatigued' ? 'bg-orange-100 text-orange-700' :
                      ad.performance_category === 'not-spending' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {ad.performance_category?.charAt(0).toUpperCase() + ad.performance_category?.slice(1) || 'Unknown'}
                    </span>
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