'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface AnalyticsPageProps {
  isDark?: boolean
}

export default function AnalyticsPage({ isDark }: AnalyticsPageProps) {
  const [loading, setLoading] = useState(true)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [adsets, setAdsets] = useState<any[]>([])
  const [ads, setAds] = useState<any[]>([])
  
  // Filters
  const [filters, setFilters] = useState({
    campaign: 'All',
    device: 'All',
    country: 'All',
    status: 'All'
  })

  // Campaign Comparison
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([])
  const [comparisonMetric, setComparisonMetric] = useState('spend_7d')

  // Line Graph Settings
  const [lineMetricY, setLineMetricY] = useState('roas_7d')

  // Performance Trend Settings
  const [scatterMetricY, setScatterMetricY] = useState('revenue_7d')
  
  // Top 10 sort by
  const [top10SortBy, setTop10SortBy] = useState('spend_7d')

  // Level selector
  const [analyticsLevel, setAnalyticsLevel] = useState<'campaign' | 'adset' | 'creative'>('campaign')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    
    try {
      // Fetch campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .limit(1000)

      if (campaignsError) {
        console.error('Error fetching campaigns:', campaignsError)
      } else {
        const enrichedCampaigns = (campaignsData || []).map(c => ({
          ...c,
          revenue_7d: parseFloat(c.revenue_7d || 0),
          spend_7d: parseFloat(c.spend_7d || 0),
          roas_7d: parseFloat(c.spend_7d || 0) > 0 ? parseFloat(c.revenue_7d || 0) / parseFloat(c.spend_7d || 0) : 0,
          week: extractWeek(c.campaign_name)
        }))
        setCampaigns(enrichedCampaigns)
        
        // Auto-select top 3 campaigns
        const top3 = enrichedCampaigns
          .sort((a, b) => b.spend_7d - a.spend_7d)
          .slice(0, 3)
          .map(c => c.campaign_name)
        setSelectedCampaigns(top3)
      }

      // Fetch ad sets
      const { data: adsetsData, error: adsetsError } = await supabase
        .from('adsets')
        .select('*')
        .limit(1000)

      if (!adsetsError && adsetsData) {
        const enrichedAdsets = adsetsData.map(a => ({
          ...a,
          revenue_7d: parseFloat(a.revenue_7d || 0),
          spend_7d: parseFloat(a.spend_7d || 0),
          roas_7d: parseFloat(a.spend_7d || 0) > 0 ? parseFloat(a.revenue_7d || 0) / parseFloat(a.spend_7d || 0) : 0
        }))
        setAdsets(enrichedAdsets)
      }

      // Fetch ads
      const { data: adsData, error: adsError } = await supabase
        .from('creative_performance')
        .select('*')
        .limit(10000)

      if (!adsError && adsData) {
        const enrichedAds = adsData.map(ad => ({
          ...ad,
          revenue_7d: parseFloat(ad.revenue_7d || 0),
          spend_7d: parseFloat(ad.spend_7d || 0),
          roas_7d: parseFloat(ad.spend_7d || 0) > 0 ? parseFloat(ad.revenue_7d || 0) / parseFloat(ad.spend_7d || 0) : 0
        }))
        setAds(enrichedAds)
      }

    } catch (err) {
      console.error('Error:', err)
    }
    
    setLoading(false)
  }

  function extractWeek(campaignName: string) {
    const match = campaignName?.match(/Week(\d+)/i)
    return match ? parseInt(match[1]) : 0
  }

  // Apply filters - use different data source based on level
  const getDataForLevel = () => {
    switch(analyticsLevel) {
      case 'campaign':
        return campaigns
      case 'adset':
        return adsets
      case 'creative':
        return ads
      default:
        return campaigns
    }
  }

  const currentData = getDataForLevel()
  
  const filteredData = currentData.filter((item: any) => {
    if (analyticsLevel === 'campaign') {
      if (filters.campaign !== 'All' && item.campaign_name !== filters.campaign) return false
      if (filters.device !== 'All' && item.primary_device !== filters.device) return false
      if (filters.country !== 'All' && item.primary_country !== filters.country) return false
      if (filters.status !== 'All' && item.status !== filters.status) return false
    } else if (analyticsLevel === 'adset') {
      if (filters.device !== 'All' && item.primary_device !== filters.device) return false
      if (filters.country !== 'All' && item.primary_country !== filters.country) return false
      if (filters.status !== 'All' && item.status !== filters.status) return false
    } else {
      // creative level
      if (filters.campaign !== 'All' && item.batch !== filters.campaign) return false
      if (filters.device !== 'All' && item.primary_device !== filters.device) return false
      if (filters.country !== 'All' && item.primary_country !== filters.country) return false
      if (filters.status !== 'All' && item.status !== filters.status) return false
    }
    return true
  })

  // Calculate totals
  const totals = filteredData.reduce((acc: any, item: any) => {
    acc.spend += item.spend_7d || 0
    acc.revenue += item.revenue_7d || 0
    acc.impressions += item.impressions_7d || 0
    acc.clicks += item.clicks_7d || 0
    acc.conversions += item.conversions_7d || 0
    return acc
  }, { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 })

  const overallRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0
  const overallCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const overallCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
  const overallCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0

  // Filter options
  const campaignOptions = ['All', ...new Set(campaigns.map(c => c.campaign_name).filter(Boolean))].sort()
  const deviceOptions = ['All', ...new Set(campaigns.map(c => c.primary_device).filter(Boolean))].sort()
  const countryOptions = ['All', ...new Set(campaigns.map(c => c.primary_country).filter(Boolean))].sort()
  const statusOptions = ['All', 'ACTIVE', 'PAUSED']

  // Metric options
  const metricOptions = [
    { value: 'spend_7d', label: 'Spend' },
    { value: 'revenue_7d', label: 'Revenue' },
    { value: 'roas_7d', label: 'ROAS' },
    { value: 'impressions_7d', label: 'Impressions' },
    { value: 'clicks_7d', label: 'Clicks' },
    { value: 'conversions_7d', label: 'Conversions' },
    { value: 'cpm_7d', label: 'CPM' },
    { value: 'ctr_7d', label: 'CTR' },
    { value: 'cpi_7d', label: 'CPI' }
  ]

  // Prepare data for bar chart - Top 10 by selected metric
  const top10Items = [...filteredData]
    .sort((a: any, b: any) => (b[top10SortBy] || 0) - (a[top10SortBy] || 0))
    .slice(0, 10)
    .map((item: any) => ({
      name: (analyticsLevel === 'campaign' ? item.campaign_name : 
             analyticsLevel === 'adset' ? item.adset_name || item.name :
             item.ad_name)?.substring(0, 30) || 'Unknown',
      spend: item.spend_7d,
      revenue: item.revenue_7d,
      roas: item.roas_7d,
      conversions: item.conversions_7d,
      impressions: item.impressions_7d
    }))

  // Prepare data for pie chart - Spend by device
  const deviceData = Object.entries(
    filteredData.reduce((acc: any, item: any) => {
      const device = item.primary_device || 'Unknown'
      acc[device] = (acc[device] || 0) + item.spend_7d
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value }))

  // Prepare data for line chart - Campaign comparison over time/metric
  const comparisonData = prepareComparisonData()
  
  function prepareComparisonData() {
    if (selectedCampaigns.length === 0) return []

    // Always show as line graph comparing selected items
    const dataMap: any = {}
    
    selectedCampaigns.forEach(itemName => {
      const item = currentData.find((d: any) => {
        if (analyticsLevel === 'campaign') return d.campaign_name === itemName
        if (analyticsLevel === 'adset') return (d.adset_name || d.name) === itemName
        return d.ad_name === itemName
      })
      
      if (item) {
        const week = item.week || extractWeek(item.campaign_name || item.batch || '')
        const weekKey = `Week ${week}`
        
        if (!dataMap[weekKey]) {
          dataMap[weekKey] = { week: weekKey }
        }
        
        dataMap[weekKey][itemName] = item[lineMetricY] || 0
      }
    })

    return Object.values(dataMap).sort((a: any, b: any) => {
      const aWeek = parseInt(a.week.replace('Week ', '') || '0')
      const bWeek = parseInt(b.week.replace('Week ', '') || '0')
      return aWeek - bWeek
    })
  }

  // Toggle campaign selection
  const toggleCampaignSelection = (campaignName: string) => {
    if (selectedCampaigns.includes(campaignName)) {
      setSelectedCampaigns(selectedCampaigns.filter(c => c !== campaignName))
    } else if (selectedCampaigns.length < 5) {
      setSelectedCampaigns([...selectedCampaigns, campaignName])
    }
  }

  const COLORS = ['#06B6D4', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444']

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
      {/* Header with Level Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Advanced Analytics
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Deep-dive analysis with campaign comparisons and performance trends
          </p>
        </div>
        <div>
          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Analytics Level
          </label>
          <select
            value={analyticsLevel}
            onChange={(e) => setAnalyticsLevel(e.target.value as any)}
            className={`px-4 py-2 text-sm rounded-lg border font-medium ${
              isDark 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="campaign">Campaign Analytics</option>
            <option value="adset">Ad Set Analytics</option>
            <option value="creative">Creative Analytics</option>
          </select>
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Filters</h3>
        </div>

        <div className="grid grid-cols-4 gap-4">
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
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Status</label>
            <select value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4">
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Showing {filteredData.length} {analyticsLevel === 'campaign' ? 'campaigns' : analyticsLevel === 'adset' ? 'ad sets' : 'creatives'}
          </div>
          <button onClick={() => setFilters({ campaign: 'All', device: 'All', country: 'All', status: 'All' })}
            className={`px-4 py-2 text-sm rounded-lg ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
            Clear Filters
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Spend</div>
          <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ${(totals.spend / 1000).toFixed(1)}K
          </div>
        </div>
        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Revenue</div>
          <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ${(totals.revenue / 1000).toFixed(1)}K
          </div>
        </div>
        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Overall ROAS</div>
          <div className={`text-3xl font-bold ${overallRoas >= 2 ? 'text-green-600' : overallRoas >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
            {overallRoas.toFixed(2)}x
          </div>
        </div>
        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Conversions</div>
          <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {totals.conversions.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Top 10 - Bar Chart */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Top 10 {analyticsLevel === 'campaign' ? 'Campaigns' : analyticsLevel === 'adset' ? 'Ad Sets' : 'Creatives'}
          </h3>
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Sort By</label>
            <select value={top10SortBy} onChange={(e) => setTop10SortBy(e.target.value)}
              className={`px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
              <option value="spend_7d">Spend</option>
              <option value="revenue_7d">Revenue</option>
              <option value="roas_7d">ROAS</option>
              <option value="conversions_7d">Conversions</option>
              <option value="impressions_7d">Impressions</option>
            </select>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={top10Items} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
            <XAxis 
              type="category"
              dataKey="name" 
              stroke={isDark ? '#9CA3AF' : '#6B7280'}
              tick={{ fontSize: 11 }}
              interval={0}
            />
            <YAxis type="number" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
            <Tooltip contentStyle={{ backgroundColor: isDark ? '#1F2937' : '#FFFFFF', border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`, borderRadius: '8px' }} />
            <Legend />
            <Bar dataKey="spend" fill="#06B6D4" name="Spend ($)" />
            <Bar dataKey="revenue" fill="#10B981" name="Revenue ($)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Spend Distribution - Pie Chart */}
      <div className="grid grid-cols-2 gap-6">
        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Spend Distribution by Device
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={deviceData} cx="50%" cy="50%" labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80} fill="#8884d8" dataKey="value">
                {deviceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Performance Metrics
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>CTR</span>
              <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{overallCtr.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>CPM</span>
              <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>${overallCpm.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>CPC</span>
              <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>${overallCpc.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Impressions</span>
              <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{(totals.impressions / 1000000).toFixed(2)}M</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Clicks</span>
              <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{(totals.clicks / 1000).toFixed(1)}K</span>
            </div>
          </div>
        </div>
      </div>

      {/* Head-to-Head Comparison - Line Chart */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {analyticsLevel === 'campaign' ? 'Campaign' : analyticsLevel === 'adset' ? 'Ad Set' : 'Creative'} Head-to-Head Comparison
            </h3>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Select up to 5 {analyticsLevel === 'campaign' ? 'campaigns' : analyticsLevel === 'adset' ? 'ad sets' : 'creatives'} to compare trends over time
            </p>
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Metric</label>
            <select value={lineMetricY} onChange={(e) => setLineMetricY(e.target.value)}
              className={`px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
              {metricOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        {/* Selector Pills */}
        <div className="mb-6">
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Select {analyticsLevel === 'campaign' ? 'Campaigns' : analyticsLevel === 'adset' ? 'Ad Sets' : 'Creatives'} (max 5)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {campaignOptions.filter(c => c !== 'All').map(campaign => (
              <button key={campaign} onClick={() => toggleCampaignSelection(campaign)}
                className={`px-3 py-2 text-xs rounded-lg transition-colors text-left truncate ${
                  selectedCampaigns.includes(campaign)
                    ? 'bg-cyan-600 text-white'
                    : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={campaign}>
                {campaign}
              </button>
            ))}
          </div>
        </div>

        {selectedCampaigns.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
              <XAxis dataKey="week" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
              <YAxis stroke={isDark ? '#9CA3AF' : '#6B7280'} />
              <Tooltip contentStyle={{ backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderRadius: '8px' }} />
              <Legend />
              {selectedCampaigns.map((itemName, index) => (
                <Line 
                  key={itemName} 
                  type="monotone" 
                  dataKey={itemName} 
                  stroke={COLORS[index % COLORS.length]} 
                  strokeWidth={3} 
                  dot={{ r: 5 }}
                  activeDot={{ r: 7 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className={`text-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Select {analyticsLevel === 'campaign' ? 'campaigns' : analyticsLevel === 'adset' ? 'ad sets' : 'creatives'} above to see the comparison
          </div>
        )}
      </div>

      {/* Performance Trend - Line Graph */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Performance Trend Analysis
            </h3>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              View performance trends across all {analyticsLevel === 'campaign' ? 'campaigns' : analyticsLevel === 'adset' ? 'ad sets' : 'creatives'}
            </p>
          </div>
          <div className="flex gap-3">
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Metric</label>
              <select value={scatterMetricY} onChange={(e) => setScatterMetricY(e.target.value)}
                className={`px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
                {metricOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={filteredData.slice(0, 20).map((item: any, index: number) => ({
            name: index + 1,
            value: item[scatterMetricY] || 0,
            label: (analyticsLevel === 'campaign' ? item.campaign_name : 
                   analyticsLevel === 'adset' ? item.adset_name || item.name :
                   item.ad_name)?.substring(0, 15) || 'Unknown'
          }))}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
            <XAxis 
              dataKey="name" 
              stroke={isDark ? '#9CA3AF' : '#6B7280'}
              label={{ value: `Top 20 ${analyticsLevel === 'campaign' ? 'Campaigns' : analyticsLevel === 'adset' ? 'Ad Sets' : 'Creatives'}`, position: 'insideBottom', offset: -5 }}
            />
            <YAxis stroke={isDark ? '#9CA3AF' : '#6B7280'} />
            <Tooltip 
              contentStyle={{ backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderRadius: '8px' }}
              formatter={(value: any, name: string, props: any) => [
                `${metricOptions.find(m => m.value === scatterMetricY)?.label}: ${typeof value === 'number' ? value.toFixed(2) : value}`,
                props.payload.label
              ]}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#8B5CF6" 
              strokeWidth={3}
              dot={{ fill: '#8B5CF6', r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className={`text-xs text-center mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          📈 Showing top 20 {analyticsLevel === 'campaign' ? 'campaigns' : analyticsLevel === 'adset' ? 'ad sets' : 'creatives'} by spend
        </div>
      </div>
    </div>
  )
}