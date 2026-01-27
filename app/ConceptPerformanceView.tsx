'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// Helper function to safely format numbers
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

interface ConceptPerformanceViewProps {
  isDark?: boolean
}

export default function ConceptPerformanceView({ isDark }: ConceptPerformanceViewProps) {
  const [ads, setAds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState('spend_7d')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  
  // Filters
  const [filters, setFilters] = useState({
    campaign: 'All',
    device: 'All',
    country: 'All',
    persona: 'All',
    concept: 'All',
    status: 'All',
    minSpend: 0
  })

  useEffect(() => {
    fetchAds()
  }, [])

  async function fetchAds() {
    setLoading(true)
    
    try {
      // Fetch ads from creative_performance table - with ALL fields
      const { data: adsData, error: adsError } = await supabase
        .from('creative_performance')
        .select('*')
        .limit(10000)

      if (adsError) {
        console.error('Error fetching ads:', adsError)
        setLoading(false)
        return
      }

      console.log(' Total ads fetched:', adsData?.length)
      console.log(' Sample raw ad data:', adsData?.[0])

      if (!adsData || adsData.length === 0) {
        console.warn('No ads found')
        setLoading(false)
        return
      }

      // Enrich ads with calculated metrics - match ExplorerSection logic
      const enrichedAds = adsData.map((ad: any) => {
        const spend_7d = parseFloat(ad.spend_7d || ad.spend || 0)
        const roas_7d = parseFloat(ad.roas_7d || 0) // ROAS is already in the table!
        const revenue_7d = roas_7d * spend_7d // Calculate revenue from ROAS * Spend
        const impressions_7d = parseInt(ad.impressions_7d || ad.impressions || 0)
        const clicks_7d = parseInt(ad.clicks_7d || ad.clicks || ad.link_clicks || 0)
        const conversions_7d = parseInt(ad.conversions_7d || ad.purchases || ad.conversions || 0)
        const spend_prev = parseFloat(ad.spend_prev || 0)
        
        return {
          ...ad,
          spend_7d,
          revenue_7d, // Calculated from ROAS * Spend
          roas_7d, // Use existing ROAS from table
          conversions_7d,
          cpm_7d: impressions_7d > 0 ? (spend_7d / impressions_7d) * 1000 : 0,
          ctr_7d: impressions_7d > 0 ? (clicks_7d / impressions_7d) : 0,
          ipm_7d: impressions_7d / 1000,
          cpi_7d: conversions_7d > 0 ? spend_7d / conversions_7d : 0,
          pp10k_7d: impressions_7d > 0 ? (conversions_7d / impressions_7d) * 10000 : 0,
          avg_purchase_value_7d: conversions_7d > 0 ? revenue_7d / conversions_7d : 0,
          cpp_7d: conversions_7d > 0 ? spend_7d / conversions_7d : 0,
          spend_change: spend_prev > 0 ? ((spend_7d - spend_prev) / spend_prev) * 100 : 0,
        }
      })

      console.log(' Total ads enriched:', enrichedAds.length)
      console.log(' Sample ad with revenue:', enrichedAds.find(ad => ad.revenue_7d > 0) || enrichedAds[0])
      setAds(enrichedAds)
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

  const filteredAds = ads.filter(ad => {
    if (filters.campaign !== 'All' && ad.batch !== filters.campaign) return false
    if (filters.device !== 'All' && ad.primary_device !== filters.device) return false
    if (filters.country !== 'All' && ad.primary_country !== filters.country) return false
    if (filters.persona !== 'All' && ad.persona !== filters.persona) return false
    if (filters.concept !== 'All' && ad.concept_code !== filters.concept) return false
    if (filters.status !== 'All' && ad.status !== filters.status) return false
    if (ad.spend_7d < filters.minSpend) return false
    return true
  })

  const sortedAds = [...filteredAds].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    return sortDirection === 'asc' 
      ? String(aVal || '').localeCompare(String(bVal || ''))
      : String(bVal || '').localeCompare(String(aVal || ''))
  })

  // Group ads by campaign and concept
  const campaignGroups = sortedAds.reduce((acc: any, ad) => {
    const campaign = ad.batch || ad.campaign_name || 'Unknown Campaign'
    if (!acc[campaign]) {
      acc[campaign] = {
        campaign_name: campaign,
        concepts: {},
        total_spend: 0,
        total_revenue: 0,
        total_conversions: 0
      }
    }
    
    const concept = ad.concept_code || 'Unknown Concept'
    if (!acc[campaign].concepts[concept]) {
      acc[campaign].concepts[concept] = []
    }
    
    acc[campaign].concepts[concept].push(ad)
    acc[campaign].total_spend += ad.spend_7d || 0
    acc[campaign].total_revenue += ad.revenue_7d || 0
    acc[campaign].total_conversions += ad.conversions_7d || 0
    
    return acc
  }, {})

  // Sort campaigns by spend
  const sortedCampaigns = Object.values(campaignGroups).sort((a: any, b: any) => b.total_spend - a.total_spend)
  
  // Get unique campaign count from all ads (not just filtered)
  const uniqueCampaignCount = new Set(ads.map(ad => ad.batch || ad.campaign_name).filter(Boolean)).size

  const totals = filteredAds.reduce((acc, ad) => {
    acc.spend += ad.spend_7d || 0
    acc.revenue += ad.revenue_7d || 0
    acc.impressions += ad.impressions_7d || 0
    acc.clicks += ad.clicks_7d || 0
    acc.conversions += ad.conversions_7d || 0
    return acc
  }, { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 })

  const overallRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0
  const overallCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
  const overallCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) : 0

  const campaignOptions = ['All', ...new Set(ads.map(a => a.batch).filter(Boolean))].sort()
  const deviceOptions = ['All', ...new Set(ads.map(a => a.primary_device).filter(Boolean))].sort()
  const countryOptions = ['All', ...new Set(ads.map(a => a.primary_country).filter(Boolean))].sort()
  const personaOptions = ['All', ...new Set(ads.map(a => a.persona).filter(Boolean))].sort()
  const conceptOptions = ['All', ...new Set(ads.map(a => a.concept_code).filter(Boolean))].sort()
  const statusOptions = ['All', 'ACTIVE', 'PAUSED']

  const toggleCampaignExpansion = (campaignName: string) => {
    const newExpanded = new Set(expandedCampaigns)
    if (newExpanded.has(campaignName)) {
      newExpanded.delete(campaignName)
    } else {
      newExpanded.add(campaignName)
    }
    setExpandedCampaigns(newExpanded)
  }

  // Top performing concepts
  const conceptPerformance = Object.entries(
    filteredAds.reduce((acc: any, ad) => {
      const concept = ad.concept_code || 'Unknown'
      if (!acc[concept]) {
        acc[concept] = { spend: 0, revenue: 0, conversions: 0, count: 0 }
      }
      acc[concept].spend += ad.spend_7d || 0
      acc[concept].revenue += ad.revenue_7d || 0
      acc[concept].conversions += ad.conversions_7d || 0
      acc[concept].count += 1
      return acc
    }, {})
  ).map(([concept, data]: [string, any]) => ({
    concept,
    ...data,
    roas: data.spend > 0 ? data.revenue / data.spend : 0
  })).sort((a, b) => b.spend - a.spend).slice(0, 10)

  // OS/Device breakdown
  const osBreakdown = Object.entries(
    filteredAds.reduce((acc: any, ad) => {
      const device = ad.primary_device || 'Unknown'
      if (!acc[device]) {
        acc[device] = { spend: 0, revenue: 0, conversions: 0, ads: 0 }
      }
      acc[device].spend += ad.spend_7d || 0
      acc[device].revenue += ad.revenue_7d || 0
      acc[device].conversions += ad.conversions_7d || 0
      acc[device].ads += 1
      return acc
    }, {})
  ).map(([os, data]: [string, any]) => ({
    os,
    ...data,
    roas: data.spend > 0 ? data.revenue / data.spend : 0
  })).sort((a, b) => b.spend - a.spend)

  // Historical data - group by week for trend graph
  const extractWeek = (campaignName: string) => {
    const match = campaignName?.match(/Week(\d+)|W(\d+)|week(\d+)|w(\d+)/i)
    if (match) {
      return parseInt(match[1] || match[2] || match[3] || match[4])
    }
    // Try to extract from date if available
    return 0
  }

  const historicalData = Object.values(
    filteredAds.reduce((acc: any, ad) => {
      const week = extractWeek(ad.batch || ad.campaign_name || '')
      if (week === 0) return acc // Skip ads without week info
      
      const weekKey = `Week ${week}`
      if (!acc[weekKey]) {
        acc[weekKey] = {
          week: weekKey,
          weekNum: week,
          spend: 0,
          revenue: 0,
          ads: 0
        }
      }
      acc[weekKey].spend += ad.spend_7d || 0
      acc[weekKey].revenue += ad.revenue_7d || 0
      acc[weekKey].ads += 1
      return acc
    }, {})
  ).sort((a: any, b: any) => a.weekNum - b.weekNum)

  const SortIcon = ({ field }: { field: string }) => (
    <svg 
      className={`w-4 h-4 inline ml-1 ${sortField === field ? 'text-cyan-600' : 'text-gray-400'}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
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

        <div className="grid grid-cols-6 gap-4 mb-4">
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Campaign</label>
            <select value={filters.campaign} onChange={(e) => setFilters({...filters, campaign: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
              {campaignOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Device</label>
            <select value={filters.device} onChange={(e) => setFilters({...filters, device: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
              {deviceOptions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Country</label>
            <select value={filters.country} onChange={(e) => setFilters({...filters, country: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
              {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Persona</label>
            <select value={filters.persona} onChange={(e) => setFilters({...filters, persona: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
              {personaOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Concept</label>
            <select value={filters.concept} onChange={(e) => setFilters({...filters, concept: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
              {conceptOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Status</label>
            <select value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-4">
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
            Showing {sortedAds.length} ads across {uniqueCampaignCount} campaigns
          </div>
          <button onClick={() => setFilters({ campaign: 'All', device: 'All', country: 'All', persona: 'All', concept: 'All', status: 'All', minSpend: 0 })}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            Clear Filters
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-4">
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
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Conversions</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{totals.conversions.toLocaleString()}</div>
        </div>
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Active Ads</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{sortedAds.length}</div>
        </div>
      </div>

      {/* Historical Spend vs Revenue Trend */}
      {historicalData.length > 0 && (
        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Historical Spend vs Revenue Trend
          </h3>
          <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Weekly performance across all creatives (non-cumulative)
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
              <XAxis 
                dataKey="week" 
                stroke={isDark ? '#9CA3AF' : '#6B7280'}
                tick={{ fontSize: 11 }}
              />
              <YAxis stroke={isDark ? '#9CA3AF' : '#6B7280'} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF', 
                  border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`, 
                  borderRadius: '8px' 
                }}
                formatter={(value: any) => `$${safeNumber(value, 0)}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="spend" 
                stroke="#06B6D4" 
                strokeWidth={3}
                dot={{ fill: '#06B6D4', r: 4 }}
                name="Spend ($)"
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#10B981" 
                strokeWidth={3}
                dot={{ fill: '#10B981', r: 4 }}
                name="Revenue ($)"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className={`mt-4 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            💡 Showing weekly spend and revenue - not cumulative
          </div>
        </div>
      )}

      {/* Top Performing Concepts Chart - Full Width */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Top 10 Concepts by Spend</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={conceptPerformance} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
            <XAxis type="category" dataKey="concept" stroke={isDark ? '#9CA3AF' : '#6B7280'} angle={-45} textAnchor="end" height={100} />
            <YAxis type="number" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
            <Tooltip contentStyle={{ backgroundColor: isDark ? '#1F2937' : '#FFFFFF', border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`, borderRadius: '8px' }} />
            <Legend />
            <Bar dataKey="spend" fill="#06B6D4" name="Spend ($)" />
            <Bar dataKey="revenue" fill="#10B981" name="Revenue ($)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Performance by OS/Device - Full Width */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Performance by OS/Device</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={osBreakdown}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
            <XAxis dataKey="os" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
            <YAxis stroke={isDark ? '#9CA3AF' : '#6B7280'} />
            <Tooltip contentStyle={{ backgroundColor: isDark ? '#1F2937' : '#FFFFFF', border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`, borderRadius: '8px' }} />
            <Legend />
            <Bar dataKey="spend" fill="#06B6D4" name="Spend ($)" />
            <Bar dataKey="revenue" fill="#10B981" name="Revenue ($)" />
            <Bar dataKey="ads" fill="#8B5CF6" name="Ad Count" />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {osBreakdown.map((os) => (
            <div key={os.os} className={`p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{os.os}</div>
              <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ROAS: {os.roas.toFixed(2)}x
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Concept Performance Summary - Full Width */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Concept Performance Summary</h3>
        <div className="grid grid-cols-3 gap-3">
          {conceptPerformance.map((concept, idx) => (
            <div key={concept.concept} className={`p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="flex justify-between items-start mb-2">
                <div className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{concept.concept}</div>
                <div className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>
                  {concept.count} ads
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Spend</div>
                  <div className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>${safeNumber(concept.spend, 0)}</div>
                </div>
                <div>
                  <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Revenue</div>
                  <div className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>${safeNumber(concept.revenue, 0)}</div>
                </div>
                <div>
                  <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>ROAS</div>
                  <div className={`font-semibold ${concept.roas >= 2 ? 'text-green-600' : concept.roas >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {safeNumber(concept.roas, 2)}x
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Campaign - Concept - Ads Breakdown */}
      <div className={`rounded-xl overflow-hidden shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="p-6">
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Campaign Performance by Concept</h3>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Click to expand and see which concepts are performing in each campaign</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={isDark ? 'bg-gray-750' : 'bg-gray-50'}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}></th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Campaign / Concept / Ad</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Device</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Persona</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Spend</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Revenue</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>ROAS</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Conversions</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>CPM</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>CTR</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {sortedCampaigns.map((campaign: any) => {
                const isExpanded = expandedCampaigns.has(campaign.campaign_name)
                const campaignRoas = campaign.total_spend > 0 ? campaign.total_revenue / campaign.total_spend : 0
                
                return (
                  <React.Fragment key={campaign.campaign_name}>
                    {/* Campaign Row */}
                    <tr className={`${isDark ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'} font-semibold`}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleCampaignExpansion(campaign.campaign_name)}
                          className="p-1 rounded hover:bg-gray-600 transition-colors"
                        >
                          <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                      <td className={`px-4 py-3 text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{campaign.campaign_name}</td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3"></td>
                      <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-white' : 'text-gray-900'}`}>${safeNumber(campaign.total_spend, 0)}</td>
                      <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-white' : 'text-gray-900'}`}>${safeNumber(campaign.total_revenue, 0)}</td>
                      <td className={`px-4 py-3 text-sm text-right font-bold ${campaignRoas >= 2 ? 'text-green-600' : campaignRoas >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {safeNumber(campaignRoas, 2)}x
                      </td>
                      <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-white' : 'text-gray-900'}`}>{campaign.total_conversions}</td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3"></td>
                    </tr>

                    {/* Concept Rows (when expanded) */}
                    {isExpanded && Object.entries(campaign.concepts).map(([conceptName, conceptAds]: [string, any]) => {
                      const conceptSpend = conceptAds.reduce((sum: number, ad: any) => sum + (ad.spend_7d || 0), 0)
                      const conceptRevenue = conceptAds.reduce((sum: number, ad: any) => sum + (ad.revenue_7d || 0), 0)
                      const conceptConversions = conceptAds.reduce((sum: number, ad: any) => sum + (ad.conversions_7d || 0), 0)
                      const conceptRoas = conceptSpend > 0 ? conceptRevenue / conceptSpend : 0

                      return (
                        <React.Fragment key={`${campaign.campaign_name}-${conceptName}`}>
                          {/* Concept Summary Row */}
                          <tr className={`${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                            <td className="px-4 py-2"></td>
                            <td className={`px-4 py-2 text-sm ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                              <span className="ml-6"> {conceptName}</span>
                              <span className={`ml-2 text-xs px-2 py-1 rounded-full ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>
                                {conceptAds.length} ads
                              </span>
                            </td>
                            <td className="px-4 py-2"></td>
                            <td className="px-4 py-2"></td>
                            <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>${safeNumber(conceptSpend, 0)}</td>
                            <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>${safeNumber(conceptRevenue, 0)}</td>
                            <td className={`px-4 py-2 text-sm text-right font-semibold ${conceptRoas >= 2 ? 'text-green-600' : conceptRoas >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {safeNumber(conceptRoas, 2)}x
                            </td>
                            <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{conceptConversions}</td>
                            <td className="px-4 py-2"></td>
                            <td className="px-4 py-2"></td>
                          </tr>

                          {/* Individual Ad Rows */}
                          {conceptAds.sort((a: any, b: any) => (b.spend_7d || 0) - (a.spend_7d || 0)).map((ad: any) => (
                            <tr key={ad.id} className={`${isDark ? 'bg-gray-900/30 hover:bg-gray-900/40' : 'bg-gray-50/50 hover:bg-gray-100'}`}>
                              <td className="px-4 py-2"></td>
                              <td className={`px-4 py-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                <span className="ml-12">• {ad.ad_name || 'Unnamed Ad'}</span>
                              </td>
                              <td className={`px-4 py-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  ad.primary_device === 'iOS' ? 'bg-gray-700 text-gray-200' : 
                                  ad.primary_device === 'Android' ? 'bg-green-700 text-green-200' : 
                                  ad.primary_device === 'Desktop' ? 'bg-blue-700 text-blue-200' :
                                  'bg-gray-600 text-gray-300'
                                }`}>
                                  {ad.primary_device || 'Unknown'}
                                </span>
                              </td>
                              <td className={`px-4 py-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                {ad.persona || 'N/A'}
                              </td>
                              <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>${safeNumber(ad.spend_7d, 0)}</td>
                              <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>${safeNumber(ad.revenue_7d, 0)}</td>
                              <td className={`px-4 py-2 text-sm text-right ${ad.roas_7d >= 2 ? 'text-green-600' : ad.roas_7d >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {safeNumber(ad.roas_7d, 2)}x
                              </td>
                              <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{ad.conversions_7d || 0}</td>
                              <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>${safeNumber(ad.cpm_7d, 2)}</td>
                              <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{safeNumber(ad.ctr_7d * 100, 2)}%</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      )
                    })}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}