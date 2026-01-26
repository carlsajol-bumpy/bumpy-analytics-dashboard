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
  const [sortField, setSortField] = useState('spend_7d')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  // Filters
  const [filters, setFilters] = useState({
    device: 'All', // Changed from 'os' to 'device' - uses primary_device
    country: 'All', // Uses primary_country
    persona: 'All', // Changed from 'gender' to 'persona' - uses persona field
    concept: 'All', // NEW - uses concept_code
    status: 'All',
    campaign: 'All',
    timeComparison: '7d' // '7d' = current week, 'prev' = previous week
  })

  useEffect(() => {
    fetchAdSets()
  }, [filters.timeComparison])

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

      // Also fetch ads from creative_performance for detailed filtering
      const { data: adData, error: adError } = await supabase
        .from('creative_performance')
        .select('adset_id, primary_device, primary_country, persona, concept_code, status')
        .limit(10000)

      if (adError) {
        console.error('Error fetching ads:', adError)
      }

      // Map ads to their ad sets for filtering
      const adsByAdSet: any = {}
      adData?.forEach(ad => {
        const adsetId = ad.adset_id
        if (!adsByAdSet[adsetId]) {
          adsByAdSet[adsetId] = []
        }
        adsByAdSet[adsetId].push(ad)
      })

      // Enrich ad sets with calculated metrics and associated ads
      const enrichedAdSets = adsetsData.map((adset: any) => {
        const spend = parseFloat(adset.spend_7d || 0)
        const revenue = parseFloat(adset.revenue_7d || 0)
        const impressions = parseInt(adset.impressions_7d || 0)
        const clicks = parseInt(adset.clicks_7d || 0)
        const conversions = parseInt(adset.conversions_7d || 0)
        const installs = conversions // Assuming conversions = installs
        
        const spend_prev = parseFloat(adset.spend_prev || 0)
        const revenue_prev = parseFloat(adset.revenue_prev || 0)
        const conversions_prev = parseInt(adset.conversions_prev || 0)
        
        return {
          ...adset,
          ads: adsByAdSet[adset.id] || [], // Attach ads for filtering
          roas_7d: spend > 0 ? revenue / spend : 0,
          cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
          ctr_7d: impressions > 0 ? (clicks / impressions) : 0,
          ipm: impressions / 1000,
          cpi: installs > 0 ? spend / installs : 0,
          cpc: clicks > 0 ? spend / clicks : 0,
          cpp: conversions > 0 ? spend / conversions : 0,
          cvr: clicks > 0 ? conversions / clicks : 0,
          click_to_install: clicks > 0 ? installs / clicks : 0,
          install_to_purchase: installs > 0 ? conversions / installs : 0,
          pp10k: impressions > 0 ? (conversions / impressions) * 10000 : 0,
          avg_purchase_value: conversions > 0 ? revenue / conversions : 0,
          roas_prev: spend_prev > 0 ? revenue_prev / spend_prev : 0,
          spend_change: spend_prev > 0 ? ((spend - spend_prev) / spend_prev) * 100 : 0,
          revenue_change: revenue_prev > 0 ? ((revenue - revenue_prev) / revenue_prev) * 100 : 0,
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
    
    // Filter by Persona (check ads within the ad set)
    if (filters.persona !== 'All') {
      const hasPersona = adset.ads?.some((ad: any) => 
        ad.persona === filters.persona
      )
      if (!hasPersona) return false
    }
    
    // Filter by Concept (check ads within the ad set)
    if (filters.concept !== 'All') {
      const hasConcept = adset.ads?.some((ad: any) => 
        ad.concept_code === filters.concept
      )
      if (!hasConcept) return false
    }
    
    // Filter by Campaign
    if (filters.campaign !== 'All' && adset.campaign_name !== filters.campaign) return false
    
    // Filter by Status
    if (filters.status !== 'All' && adset.status !== filters.status) return false
    
    return true
  })

  const sortedAdSets = [...filteredAdSets].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    
    return sortDirection === 'asc' 
      ? String(aVal || '').localeCompare(String(bVal || ''))
      : String(bVal || '').localeCompare(String(aVal || ''))
  })

  const totals = filteredAdSets.reduce((acc, adset) => {
    acc.spend += adset.spend_7d || 0
    acc.revenue += adset.revenue_7d || 0
    acc.impressions += adset.impressions_7d || 0
    acc.clicks += adset.clicks_7d || 0
    acc.conversions += adset.conversions_7d || 0
    acc.installs += adset.installs || 0
    return acc
  }, { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0, installs: 0 })

  const overallRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0
  const overallCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
  const overallCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) : 0
  const overallIpm = totals.impressions / 1000
  const overallCpi = totals.conversions > 0 ? totals.spend / totals.conversions : 0
  const overallPp10k = totals.impressions > 0 ? (totals.conversions / totals.impressions) * 10000 : 0

  const allAds = adsets.flatMap(a => a.ads || [])
  const deviceOptions = ['All', ...new Set(adsets.map((adset: any) => adset.primary_device).filter(Boolean))].sort()
  const countryOptions = ['All', ...new Set(adsets.map((adset: any) => adset.primary_country).filter(Boolean))].sort()
  const personaOptions = ['All', ...new Set(allAds.map((ad: any) => ad.persona).filter(Boolean))].sort()
  const conceptOptions = ['All', ...new Set(allAds.map((ad: any) => ad.concept_code).filter(Boolean))].sort()
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

        <div className="grid grid-cols-6 gap-4">
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
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Persona</label>
            <select
              value={filters.persona}
              onChange={(e) => setFilters({...filters, persona: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {personaOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Concept</label>
            <select
              value={filters.concept}
              onChange={(e) => setFilters({...filters, concept: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {conceptOptions.map(c => <option key={c} value={c}>{c}</option>)}
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
          </div>
          <button
            onClick={() => setFilters({ device: 'All', country: 'All', persona: 'All', concept: 'All', status: 'All', campaign: 'All', timeComparison: '7d' })}
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
        {/* Bar Chart - Week Comparison */}
        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Performance: Current Week vs Previous Week
            </h3>
            {(filters.device !== 'All' || filters.country !== 'All' || filters.persona !== 'All' || filters.concept !== 'All' || filters.campaign !== 'All') && (
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
                'Current Week': totals.spend,
                'Previous Week': filteredAdSets.reduce((sum, a) => sum + (a.spend_prev || 0), 0)
              },
              {
                metric: 'Revenue',
                'Current Week': totals.revenue,
                'Previous Week': filteredAdSets.reduce((sum, a) => sum + (a.revenue_prev || 0), 0)
              },
              {
                metric: 'Conversions',
                'Current Week': totals.conversions,
                'Previous Week': filteredAdSets.reduce((sum, a) => sum + (a.conversions_prev || 0), 0)
              },
              {
                metric: 'ROAS',
                'Current Week': overallRoas,
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
            💡 Tip: Showing data for {filteredAdSets.length} ad set(s) based on your filters
          </div>
        </div>

        {/* Pie Chart - Ad Set Distribution by Performance */}
        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Spend Distribution by Ad Set (Top 5)
            {filters.campaign !== 'All' && (
              <span className={`ml-2 text-sm font-normal ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                - Filtered by: {filters.campaign}
              </span>
            )}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={sortedAdSets.slice(0, 5).map(adset => ({
                  name: adset.adset_name.length > 20 ? adset.adset_name.substring(0, 20) + '...' : adset.adset_name,
                  fullName: adset.adset_name,
                  value: adset.spend_7d
                }))}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.name}: ${(entry.percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                onClick={(data: any) => {
                  // Filter by clicking on pie slice
                  console.log('Clicked ad set:', data.fullName)
                  // You could add a filter here if needed
                }}
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
            💡 Tip: Charts update automatically when you change filters above
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
                <th onClick={() => handleSort('spend_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Spend <SortIcon field="spend_7d" />
                </th>
                <th onClick={() => handleSort('spend_change')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Change <SortIcon field="spend_change" />
                </th>
                <th onClick={() => handleSort('revenue_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Value <SortIcon field="revenue_7d" />
                </th>
                <th onClick={() => handleSort('cpm')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  CPM <SortIcon field="cpm" />
                </th>
                <th onClick={() => handleSort('ctr_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  CTR <SortIcon field="ctr_7d" />
                </th>
                <th onClick={() => handleSort('ipm')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  IPM <SortIcon field="ipm" />
                </th>
                <th onClick={() => handleSort('conversions_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Installs <SortIcon field="conversions_7d" />
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
                <th onClick={() => handleSort('roas_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  ROAS <SortIcon field="roas_7d" />
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {sortedAdSets.map((adset) => (
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
                    ${safeNumber(adset.spend_7d, 0)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${
                    adset.spend_change > 0 ? 'text-green-600' : 
                    adset.spend_change < 0 ? 'text-red-600' : 
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {adset.spend_change > 0 ? '+' : ''}{safeNumber(adset.spend_change, 1)}%
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    ${safeNumber(adset.revenue_7d, 0)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    ${safeNumber(adset.cpm, 2)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {safeNumber(adset.ctr_7d * 100, 2)}%
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {safeNumber(adset.ipm, 1)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {adset.conversions_7d}
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
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    ${safeNumber(adset.cpp, 2)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${
                    adset.roas_7d >= 2.0 ? 'text-green-600' : 
                    adset.roas_7d >= 1.0 ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}>
                    {safeNumber(adset.roas_7d, 2)}x
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