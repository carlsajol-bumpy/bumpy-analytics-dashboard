'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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

interface CampaignLevelViewProps {
  isDark?: boolean
}

export default function CampaignLevelView({ isDark }: CampaignLevelViewProps) {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [adsets, setAdsets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState('spend_7d')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([])
  
  // Filters
  const [filters, setFilters] = useState({
    device: 'All',
    country: 'All',
    persona: 'All',
    concept: 'All',
    status: 'All'
  })

  useEffect(() => {
    fetchCampaigns()
  }, [])

  async function fetchCampaigns() {
    setLoading(true)
    
    try {
      // Fetch campaigns from campaigns table
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .limit(1000)

      if (campaignError) {
        console.error('Error fetching campaigns:', campaignError)
        setLoading(false)
        return
      }

      console.log('📊 Total campaigns fetched:', campaignData?.length)

      if (!campaignData || campaignData.length === 0) {
        console.warn('No campaigns found')
        setLoading(false)
        return
      }

      // Fetch ad sets
      const { data: adsetsData, error: adsetsError } = await supabase
        .from('adsets')
        .select('*')
        .limit(1000)

      if (adsetsError) {
        console.error('Error fetching ad sets:', adsetsError)
      } else {
        const enrichedAdSets = (adsetsData || []).map((adset: any) => {
          const spend_7d = parseFloat(adset.spend_7d || 0)
          const revenue_7d = parseFloat(adset.revenue_7d || 0)
          const impressions_7d = parseInt(adset.impressions_7d || 0)
          const clicks_7d = parseInt(adset.clicks_7d || 0)
          const conversions_7d = parseInt(adset.conversions_7d || 0)
          const spend_prev = parseFloat(adset.spend_prev || 0)
          
          return {
            ...adset,
            roas_7d: spend_7d > 0 ? revenue_7d / spend_7d : 0,
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
        setAdsets(enrichedAdSets)
      }

      // Also fetch ads for filtering
      const { data: adData, error: adError } = await supabase
        .from('creative_performance')
        .select('campaign_id, batch, persona, concept_code')
        .limit(10000)

      const adsByCampaign: any = {}
      adData?.forEach(ad => {
        const campaignId = ad.campaign_id || ad.batch
        if (!adsByCampaign[campaignId]) {
          adsByCampaign[campaignId] = []
        }
        adsByCampaign[campaignId].push(ad)
      })

      const enrichedCampaigns = campaignData.map((campaign: any) => {
        const spend_7d = parseFloat(campaign.spend_7d || 0)
        const revenue_7d = parseFloat(campaign.revenue_7d || 0)
        const impressions_7d = parseInt(campaign.impressions_7d || 0)
        const clicks_7d = parseInt(campaign.clicks_7d || 0)
        const conversions_7d = parseInt(campaign.conversions_7d || 0)
        const spend_prev = parseFloat(campaign.spend_prev || 0)
        const revenue_prev = parseFloat(campaign.revenue_prev || 0)
        
        return {
          ...campaign,
          ads: adsByCampaign[campaign.campaign_id || campaign.id] || [],
          roas_7d: spend_7d > 0 ? revenue_7d / spend_7d : 0,
          cpm_7d: impressions_7d > 0 ? (spend_7d / impressions_7d) * 1000 : 0,
          ctr_7d: impressions_7d > 0 ? (clicks_7d / impressions_7d) : 0,
          ipm_7d: impressions_7d / 1000,
          cpi_7d: conversions_7d > 0 ? spend_7d / conversions_7d : 0,
          pp10k_7d: impressions_7d > 0 ? (conversions_7d / impressions_7d) * 10000 : 0,
          avg_purchase_value_7d: conversions_7d > 0 ? revenue_7d / conversions_7d : 0,
          cpp_7d: conversions_7d > 0 ? spend_7d / conversions_7d : 0,
          spend_change: spend_prev > 0 ? ((spend_7d - spend_prev) / spend_prev) * 100 : 0,
          roas_prev: spend_prev > 0 ? revenue_prev / spend_prev : 0
        }
      })

      setCampaigns(enrichedCampaigns)
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

  const filteredCampaigns = campaigns.filter(campaign => {
    if (filters.device !== 'All' && campaign.primary_device !== filters.device) return false
    if (filters.country !== 'All' && campaign.primary_country !== filters.country) return false
    if (filters.persona !== 'All') {
      const hasPersona = campaign.ads?.some((ad: any) => ad.persona === filters.persona)
      if (!hasPersona) return false
    }
    if (filters.concept !== 'All') {
      const hasConcept = campaign.ads?.some((ad: any) => ad.concept_code === filters.concept)
      if (!hasConcept) return false
    }
    if (filters.status !== 'All' && campaign.status !== filters.status) return false
    return true
  })

  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    return sortDirection === 'asc' 
      ? String(aVal || '').localeCompare(String(bVal || ''))
      : String(bVal || '').localeCompare(String(aVal || ''))
  })

  const totals = filteredCampaigns.reduce((acc, c) => {
    acc.spend += c.spend_7d || 0
    acc.revenue += c.revenue_7d || 0
    acc.impressions += c.impressions_7d || 0
    acc.clicks += c.clicks_7d || 0
    acc.conversions += c.conversions_7d || 0
    return acc
  }, { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 })

  const overallRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0
  const overallCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
  const overallCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) : 0
  const overallIpm = totals.impressions / 1000
  const overallCpi = totals.conversions > 0 ? totals.spend / totals.conversions : 0
  const overallPp10k = totals.impressions > 0 ? (totals.conversions / totals.impressions) * 10000 : 0

  const allAds = campaigns.flatMap(c => c.ads || [])
  const deviceOptions = ['All', ...new Set(campaigns.map((c: any) => c.primary_device).filter(Boolean))].sort()
  const countryOptions = ['All', ...new Set(campaigns.map((c: any) => c.primary_country).filter(Boolean))].sort()
  const personaOptions = ['All', ...new Set(allAds.map((ad: any) => ad.persona).filter(Boolean))].sort()
  const conceptOptions = ['All', ...new Set(allAds.map((ad: any) => ad.concept_code).filter(Boolean))].sort()
  const statusOptions = ['All', 'ACTIVE', 'PAUSED']

  const toggleCampaignExpansion = (campaignId: string) => {
    const newExpanded = new Set(expandedCampaigns)
    if (newExpanded.has(campaignId)) {
      newExpanded.delete(campaignId)
    } else {
      newExpanded.add(campaignId)
    }
    setExpandedCampaigns(newExpanded)
  }

  const toggleCampaignSelection = (campaignName: string) => {
    if (selectedCampaigns.includes(campaignName)) {
      setSelectedCampaigns(selectedCampaigns.filter(c => c !== campaignName))
    } else {
      setSelectedCampaigns([...selectedCampaigns, campaignName])
    }
  }

  const getCampaignAdSets = (campaignId: string) => {
    return adsets.filter(adset => adset.campaign_id === campaignId)
  }

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
          <span className={`ml-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Loading campaigns...</span>
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
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>OS / Device</label>
            <select value={filters.device} onChange={(e) => setFilters({...filters, device: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
              {deviceOptions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Country / Region</label>
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

        <div className="flex items-center justify-between mt-4">
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Showing {sortedCampaigns.length} campaigns</div>
          <button onClick={() => setFilters({ device: 'All', country: 'All', persona: 'All', concept: 'All', status: 'All' })}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            Clear Filters
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-8 gap-4">
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Spend</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>${safeNumber(totals.spend / 1000, 1)}K</div>
        </div>
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Purchase Value</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>${safeNumber(totals.revenue / 1000, 1)}K</div>
        </div>
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>CPM</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>${safeNumber(overallCpm, 2)}</div>
        </div>
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>CTR</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{safeNumber(overallCtr * 100, 2)}%</div>
        </div>
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>IPM</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{safeNumber(overallIpm, 1)}</div>
        </div>
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>CPI</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>${safeNumber(overallCpi, 2)}</div>
        </div>
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>PP10K</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{safeNumber(overallPp10k, 1)}</div>
        </div>
        <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Purchase ROAS</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{safeNumber(overallRoas, 2)}x</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Performance: Current vs Previous Week</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              { metric: 'Spend', 'Current Week': totals.spend, 'Previous Week': filteredCampaigns.reduce((s, c) => s + (parseFloat(c.spend_prev) || 0), 0) },
              { metric: 'Revenue', 'Current Week': totals.revenue, 'Previous Week': filteredCampaigns.reduce((s, c) => s + (parseFloat(c.revenue_prev) || 0), 0) },
              { metric: 'Conversions', 'Current Week': totals.conversions, 'Previous Week': filteredCampaigns.reduce((s, c) => s + (parseInt(c.conversions_prev) || 0), 0) },
              { metric: 'ROAS', 'Current Week': overallRoas, 'Previous Week': filteredCampaigns.reduce((s, c) => s + (c.roas_prev || 0), 0) / (filteredCampaigns.length || 1) }
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
              <XAxis dataKey="metric" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
              <YAxis stroke={isDark ? '#9CA3AF' : '#6B7280'} />
              <Tooltip contentStyle={{ backgroundColor: isDark ? '#1F2937' : '#FFFFFF', border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`, borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="Current Week" fill="#06B6D4" />
              <Bar dataKey="Previous Week" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Spend Distribution (Top 5)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie 
                data={sortedCampaigns.slice(0, 5).map(c => ({ name: (c.campaign_name || 'Unknown').substring(0, 20), value: c.spend_7d || 0 }))}
                cx="50%" 
                cy="50%" 
                labelLine={false} 
                label={(entry: any) => `${entry.name}: ${(entry.percent * 100).toFixed(0)}%`}
                outerRadius={80} 
                fill="#8884d8" 
                dataKey="value"
              >
                {sortedCampaigns.slice(0, 5).map((e, i) => <Cell key={`cell-${i}`} fill={['#06B6D4', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'][i % 5]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: isDark ? '#1F2937' : '#FFFFFF', border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`, borderRadius: '8px' }}
                formatter={(value: any) => `$${safeNumber(value, 0)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-xl overflow-hidden shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={isDark ? 'bg-gray-750' : 'bg-gray-50'}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>SELECT</th>
                <th onClick={() => handleSort('campaign_name')} className={`px-4 py-3 text-left text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Campaign <SortIcon field="campaign_name" /></th>
                <th onClick={() => handleSort('primary_device')} className={`px-4 py-3 text-left text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Device <SortIcon field="primary_device" /></th>
                <th onClick={() => handleSort('primary_country')} className={`px-4 py-3 text-left text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Country <SortIcon field="primary_country" /></th>
                <th onClick={() => handleSort('spend_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Spend <SortIcon field="spend_7d" /></th>
                <th onClick={() => handleSort('spend_change')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Change <SortIcon field="spend_change" /></th>
                <th onClick={() => handleSort('revenue_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Revenue <SortIcon field="revenue_7d" /></th>
                <th onClick={() => handleSort('cpm_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>CPM <SortIcon field="cpm_7d" /></th>
                <th onClick={() => handleSort('ctr_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>CTR <SortIcon field="ctr_7d" /></th>
                <th onClick={() => handleSort('ipm_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>IPM <SortIcon field="ipm_7d" /></th>
                <th onClick={() => handleSort('conversions_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Conversions <SortIcon field="conversions_7d" /></th>
                <th onClick={() => handleSort('cpi_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>CPI <SortIcon field="cpi_7d" /></th>
                <th onClick={() => handleSort('pp10k_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>PP10K <SortIcon field="pp10k_7d" /></th>
                <th onClick={() => handleSort('avg_purchase_value_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Avg Purchase <SortIcon field="avg_purchase_value_7d" /></th>
                <th onClick={() => handleSort('cpp_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>CPP <SortIcon field="cpp_7d" /></th>
                <th onClick={() => handleSort('roas_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>ROAS <SortIcon field="roas_7d" /></th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {sortedCampaigns.map((campaign) => {
                const isExpanded = expandedCampaigns.has(campaign.campaign_id || campaign.id)
                const campaignAdSets = getCampaignAdSets(campaign.campaign_id || campaign.id)
                
                return (
                  <React.Fragment key={campaign.campaign_id || campaign.id}>
                    <tr className={isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedCampaigns.includes(campaign.campaign_name)}
                          onChange={() => toggleCampaignSelection(campaign.campaign_name)}
                          className="w-4 h-4 text-cyan-600 rounded"
                        />
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleCampaignExpansion(campaign.campaign_id || campaign.id)}
                            className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
                              campaignAdSets.length === 0 ? 'invisible' : ''
                            }`}
                          >
                            <svg 
                              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <span>{campaign.campaign_name || 'Unknown'}</span>
                        </div>
                      </td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <span className={`px-2 py-1 rounded-full text-xs ${campaign.primary_device === 'iOS' ? 'bg-gray-700 text-gray-200' : campaign.primary_device === 'Android' ? 'bg-green-700 text-green-200' : 'bg-blue-700 text-blue-200'}`}>
                      {campaign.primary_device || 'Unknown'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{campaign.primary_country || 'Unknown'}</td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>${safeNumber(campaign.spend_7d, 0)}</td>
                  <td className={`px-4 py-3 text-sm text-right ${campaign.spend_change > 0 ? 'text-green-600' : campaign.spend_change < 0 ? 'text-red-600' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {campaign.spend_change > 0 ? '+' : ''}{safeNumber(campaign.spend_change, 1)}%
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>${safeNumber(campaign.revenue_7d, 0)}</td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>${safeNumber(campaign.cpm_7d, 2)}</td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{safeNumber(campaign.ctr_7d * 100, 2)}%</td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{safeNumber(campaign.ipm_7d, 1)}</td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{campaign.conversions_7d || 0}</td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>${safeNumber(campaign.cpi_7d, 2)}</td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{safeNumber(campaign.pp10k_7d, 1)}</td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>${safeNumber(campaign.avg_purchase_value_7d, 2)}</td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>${safeNumber(campaign.cpp_7d, 2)}</td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${campaign.roas_7d >= 2.0 ? 'text-green-600' : campaign.roas_7d >= 1.0 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {safeNumber(campaign.roas_7d, 2)}x
                  </td>
                </tr>

                {/* Expanded Ad Sets */}
                {isExpanded && campaignAdSets.length > 0 && campaignAdSets.map((adset) => (
                  <tr 
                    key={adset.id} 
                    className={`${isDark ? 'bg-gray-900/30 hover:bg-gray-900/50' : 'bg-gray-50/50 hover:bg-gray-100'}`}
                  >
                    <td className="px-4 py-2"></td>
                    <td className={`px-4 py-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <span className="ml-8 text-cyan-600">Ad Set / {adset.adset_name || adset.name || 'Unknown'}</span>
                    </td>
                    <td className={`px-4 py-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      <span className={`px-2 py-1 rounded-full text-xs ${adset.primary_device === 'iOS' ? 'bg-gray-700 text-gray-200' : adset.primary_device === 'Android' ? 'bg-green-700 text-green-200' : 'bg-blue-700 text-blue-200'}`}>
                        {adset.primary_device || 'Unknown'}
                      </span>
                    </td>
                    <td className={`px-4 py-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{adset.primary_country || 'Unknown'}</td>
                    <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>${safeNumber(adset.spend_7d, 0)}</td>
                    <td className={`px-4 py-2 text-sm text-right ${adset.spend_change > 0 ? 'text-green-600' : adset.spend_change < 0 ? 'text-red-600' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {adset.spend_change > 0 ? '+' : ''}{safeNumber(adset.spend_change, 1)}%
                    </td>
                    <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>${safeNumber(adset.revenue_7d, 0)}</td>
                    <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>${safeNumber(adset.cpm_7d, 2)}</td>
                    <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{safeNumber(adset.ctr_7d * 100, 2)}%</td>
                    <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{safeNumber(adset.ipm_7d, 1)}</td>
                    <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{adset.conversions_7d || 0}</td>
                    <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>${safeNumber(adset.cpi_7d, 2)}</td>
                    <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{safeNumber(adset.pp10k_7d, 1)}</td>
                    <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>${safeNumber(adset.avg_purchase_value_7d, 2)}</td>
                    <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>${safeNumber(adset.cpp_7d, 2)}</td>
                    <td className={`px-4 py-2 text-sm text-right font-medium ${adset.roas_7d >= 2.0 ? 'text-green-600' : adset.roas_7d >= 1.0 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {safeNumber(adset.roas_7d, 2)}x
                    </td>
                  </tr>
                ))}
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