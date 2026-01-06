'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalSpend: 0,
    avgRoas: 0,
    activeAds: 0,
    conversions: 0
  })
  const [ads, setAds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    platform: 'All',
    concept: 'All',
    persona: 'All'
  })

  useEffect(() => {
    fetchData()
  }, [filters])

  async function fetchData() {
    setLoading(true)
    
    // Build query
    let query = supabase
      .from('creative_performance')
      .select('*')
      .eq('status', 'ACTIVE')

    // Apply filters
    if (filters.platform !== 'All') {
      query = query.eq('platform', filters.platform)
    }
    if (filters.concept !== 'All') {
      query = query.eq('concept_code', filters.concept)
    }
    if (filters.persona !== 'All') {
      query = query.eq('persona', filters.persona)
    }

    const { data, error } = await query.order('spend_7d', { ascending: false })

    if (data) {
      setAds(data)
      
      // Calculate stats
      const totalSpend = data.reduce((sum: number, ad: any) => sum + parseFloat(ad.spend_7d || 0), 0)
      const avgRoas = data.length > 0 
        ? data.reduce((sum: number, ad: any) => sum + parseFloat(ad.roas_7d || 0), 0) / data.length 
        : 0
      const conversions = data.reduce((sum: number, ad: any) => sum + parseInt(ad.conversions_7d || 0), 0)
      
      setStats({
        totalSpend,
        avgRoas,
        activeAds: data.length,
        conversions
      })
    }
    
    if (error) {
      console.error('Error fetching data:', error)
    }
    
    setLoading(false)
  }

  // Get unique values for filters
  const platforms = ['All', ...new Set(ads.map(ad => ad.platform).filter(Boolean))]
  const concepts = ['All', ...new Set(ads.map(ad => ad.concept_code).filter(Boolean))]
  const personas = ['All', ...new Set(ads.map(ad => ad.persona).filter(Boolean))]

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Marketing Analytics Dashboard</h1>
          <p className="text-gray-600 mt-2">Real-time performance metrics across all platforms</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
              <select 
                value={filters.platform}
                onChange={(e) => setFilters({...filters, platform: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {platforms.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Concept</label>
              <select 
                value={filters.concept}
                onChange={(e) => setFilters({...filters, concept: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {concepts.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Persona</label>
              <select 
                value={filters.persona}
                onChange={(e) => setFilters({...filters, persona: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {personas.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <StatCard 
            label="Total Spend" 
            value={`$${stats.totalSpend.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
            bgColor="bg-blue-50"
            textColor="text-blue-700"
          />
          <StatCard 
            label="Avg. ROAS" 
            value={`${stats.avgRoas.toFixed(2)}x`}
            bgColor="bg-green-50"
            textColor="text-green-700"
          />
          <StatCard 
            label="Active Ads" 
            value={stats.activeAds}
            bgColor="bg-purple-50"
            textColor="text-purple-700"
          />
          <StatCard 
            label="Conversions" 
            value={stats.conversions}
            bgColor="bg-orange-50"
            textColor="text-orange-700"
          />
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-500">Loading data...</div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ad Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Concept</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Persona</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Spend (7d)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ROAS</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">CTR</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Conversions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ads.map((ad) => (
                    <tr key={ad.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {ad.ad_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          ad.platform === 'meta' ? 'bg-blue-100 text-blue-800' : 
                          ad.platform === 'tiktok' ? 'bg-pink-100 text-pink-800' : 
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {ad.platform}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {ad.concept_code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {ad.persona}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        ${parseFloat(ad.spend_7d || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {parseFloat(ad.roas_7d || 0).toFixed(2)}x
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {(parseFloat(ad.ctr_7d || 0) * 100).toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {parseInt(ad.conversions_7d || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {ads.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-500">
                No ads found matching your filters
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, bgColor, textColor }: { label: string, value: string | number, bgColor: string, textColor: string }) {
  return (
    <div className={`${bgColor} rounded-lg p-6 shadow-sm`}>
      <div className="text-sm font-medium text-gray-600 mb-1">{label}</div>
      <div className={`text-3xl font-bold ${textColor}`}>{value}</div>
    </div>
  )
}