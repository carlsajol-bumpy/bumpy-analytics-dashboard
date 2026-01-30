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

type DateRangeOption = 
  | 'today' 
  | 'yesterday' 
  | 'last_7d' 
  | 'last_14d' 
  | 'last_28d'
  | 'last_30d'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'

export default function ConceptPerformanceView({ isDark }: ConceptPerformanceViewProps) {
  const [ads, setAds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState('spend_7d')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  const [showDatePicker, setShowDatePicker] = useState(false)
  
  // Filters with multi-select support for BOTH concept and persona
  const [filters, setFilters] = useState({
    campaign: 'All',
    device: 'All',
    country: 'All',
    persona: [] as string[], //  CHANGED to multi-select array
    concept: [] as string[],
    status: 'All',
    minSpend: 0,
    dateRange: 'last_7d' as DateRangeOption
  })

  useEffect(() => {
    fetchAds()
  }, [])

  async function fetchAds() {
    setLoading(true)
    
    try {
      const { data: adsData, error: adsError } = await supabase
        .from('creative_performance')
        .select('*')
        .limit(50000)

      if (adsError) {
        console.error('Error fetching ads:', adsError)
        setLoading(false)
        return
      }

      console.log(' Total ads fetched:', adsData?.length)
      console.log(' Sample raw ad data:', adsData?.[0])
      
      if (adsData?.length >= 50000) {
        console.warn('⚠️ WARNING: Hit query limit! Some campaigns may be missing.')
      }

      if (!adsData || adsData.length === 0) {
        console.warn('No ads found')
        setLoading(false)
        return
      }

      const enrichedAds = adsData.map((ad: any) => {
        const spend_7d = parseFloat(ad.spend_7d || ad.spend || 0)
        const roas_7d = parseFloat(ad.roas_7d || 0)
        const revenue_7d = roas_7d * spend_7d
        const impressions_7d = parseInt(ad.impressions_7d || ad.impressions || 0)
        const clicks_7d = parseInt(ad.clicks_7d || ad.clicks || ad.link_clicks || 0)
        const conversions_7d = parseInt(ad.conversions_7d || ad.purchases || ad.conversions || 0)
        
        const spend_prev = parseFloat(ad.spend_prev || 0)
        const roas_prev = parseFloat(ad.roas_prev || 0)
        const revenue_prev = roas_prev * spend_prev
        const impressions_prev = parseInt(ad.impressions_prev || 0)
        const clicks_prev = parseInt(ad.clicks_prev || 0)
        const conversions_prev = parseInt(ad.conversions_prev || 0)
        
        const spend_28d = parseFloat(ad.spend_28d || 0)
        const roas_28d = parseFloat(ad.roas_28d || 0)
        const revenue_28d = roas_28d * spend_28d
        const impressions_28d = parseInt(ad.impressions_28d || 0)
        const clicks_28d = parseInt(ad.clicks_28d || 0)
        const conversions_28d = parseInt(ad.conversions_28d || 0)
        
        const spend_30d = parseFloat(ad.spend_30d || 0)
        const roas_30d = parseFloat(ad.roas_30d || 0)
        const revenue_30d = roas_30d * spend_30d
        const impressions_30d = parseInt(ad.impressions_30d || 0)
        const clicks_30d = parseInt(ad.clicks_30d || 0)
        const conversions_30d = parseInt(ad.conversions_30d || 0)
        
        return {
          ...ad,
          spend_7d,
          revenue_7d,
          roas_7d,
          conversions_7d,
          impressions_7d,
          clicks_7d,
          spend_prev,
          revenue_prev,
          roas_prev,
          conversions_prev,
          impressions_prev,
          clicks_prev,
          spend_28d,
          revenue_28d,
          roas_28d,
          conversions_28d,
          impressions_28d,
          clicks_28d,
          spend_30d,
          revenue_30d,
          roas_30d,
          conversions_30d,
          impressions_30d,
          clicks_30d,
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

  const getDateRangeLabel = (range: DateRangeOption): string => {
    const labels: Record<DateRangeOption, string> = {
      'today': 'Today',
      'yesterday': 'Yesterday',
      'last_7d': 'Last 7 days',
      'last_14d': 'Last 14 days',
      'last_28d': 'Last 28 days',
      'last_30d': 'Last 30 days',
      'this_week': 'This week',
      'last_week': 'Last week',
      'this_month': 'This month',
      'last_month': 'Last month'
    }
    return labels[range]
  }

  const getFilteredDataByDateRange = (ad: any) => {
    switch (filters.dateRange) {
      case 'today':
      case 'yesterday':
      case 'last_7d':
      case 'this_week':
        return {
          spend: ad.spend_7d || 0,
          revenue: ad.revenue_7d || 0,
          impressions: ad.impressions_7d || 0,
          clicks: ad.clicks_7d || 0,
          conversions: ad.conversions_7d || 0,
          roas: ad.roas_7d || 0,
          reach: ad.reach_7d || 0,
          link_clicks: ad.link_clicks_7d || 0
        }
      case 'last_week':
      case 'last_14d':
        return {
          spend: ad.spend_prev || 0,
          revenue: ad.revenue_prev || 0,
          impressions: ad.impressions_prev || 0,
          clicks: ad.clicks_prev || 0,
          conversions: ad.conversions_prev || 0,
          roas: ad.roas_prev || 0,
          reach: ad.reach_prev || 0,
          link_clicks: ad.link_clicks_prev || 0
        }
      case 'last_28d':
      case 'this_month':
        return {
          spend: ad.spend_28d || 0,
          revenue: ad.revenue_28d || 0,
          impressions: ad.impressions_28d || 0,
          clicks: ad.clicks_28d || 0,
          conversions: ad.conversions_28d || 0,
          roas: ad.roas_28d || 0,
          reach: ad.reach_28d || 0,
          link_clicks: ad.link_clicks_28d || 0
        }
      case 'last_30d':
      case 'last_month':
        return {
          spend: ad.spend_30d || 0,
          revenue: ad.revenue_30d || 0,
          impressions: ad.impressions_30d || 0,
          clicks: ad.clicks_30d || 0,
          conversions: ad.conversions_30d || 0,
          roas: ad.roas_30d || 0,
          reach: ad.reach_30d || 0,
          link_clicks: ad.link_clicks_30d || 0
        }
      default:
        return {
          spend: ad.spend_7d || 0,
          revenue: ad.revenue_7d || 0,
          impressions: ad.impressions_7d || 0,
          clicks: ad.clicks_7d || 0,
          conversions: ad.conversions_7d || 0,
          roas: ad.roas_7d || 0,
          reach: ad.reach_7d || 0,
          link_clicks: ad.link_clicks_7d || 0
        }
    }
  }

  const filteredAds = ads.filter(ad => {
    if (filters.campaign !== 'All' && ad.batch !== filters.campaign) return false
    if (filters.device !== 'All' && ad.primary_device !== filters.device) return false
    if (filters.country !== 'All' && ad.primary_country !== filters.country) return false
    
    //  UPDATED: Multi-select persona filter
    if (filters.persona.length > 0 && !filters.persona.includes(ad.persona)) return false
    
    if (filters.concept.length > 0 && !filters.concept.includes(ad.concept_code)) return false
    if (filters.status !== 'All' && ad.status !== filters.status) return false
    
    const dateRangeData = getFilteredDataByDateRange(ad)
    if (dateRangeData.spend < filters.minSpend) return false
    
    return true
  }).map(ad => ({
    ...ad,
    ...getFilteredDataByDateRange(ad)
  }))

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
    acc[campaign].total_spend += ad.spend || 0
    acc[campaign].total_revenue += ad.revenue || 0
    acc[campaign].total_conversions += ad.conversions || 0
    
    return acc
  }, {})

  const sortedCampaigns = Object.values(campaignGroups).sort((a: any, b: any) => b.total_spend - a.total_spend)
  
  const filteredCampaignCount = new Set(
    filteredAds.map(ad => ad.batch || ad.campaign_name).filter(v => v && v !== 'Unknown Campaign')
  ).size
  const totalCampaignCount = new Set(
    ads.map(ad => ad.batch || ad.campaign_name).filter(v => v && v !== 'Unknown Campaign')
  ).size

  const totals = filteredAds.reduce((acc, ad) => {
    acc.spend += ad.spend || 0
    acc.revenue += ad.revenue || 0
    acc.impressions += ad.impressions || 0
    acc.clicks += ad.clicks || 0
    acc.conversions += ad.conversions || 0
    return acc
  }, { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 })

  const overallRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0

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

  const conceptPerformance = Object.entries(
    filteredAds.reduce((acc: any, ad) => {
      const concept = ad.concept_code || 'Unknown'
      if (!acc[concept]) {
        acc[concept] = { spend: 0, revenue: 0, conversions: 0, count: 0 }
      }
      acc[concept].spend += ad.spend || 0
      acc[concept].revenue += ad.revenue || 0
      acc[concept].conversions += ad.conversions || 0
      acc[concept].count += 1
      return acc
    }, {})
  ).map(([concept, data]: [string, any]) => ({
    concept,
    ...data,
    roas: data.spend > 0 ? data.revenue / data.spend : 0
  })).sort((a, b) => b.spend - a.spend).slice(0, 10)

  const osBreakdown = Object.entries(
    filteredAds.reduce((acc: any, ad) => {
      const device = ad.primary_device || 'Unknown'
      if (!acc[device]) {
        acc[device] = { spend: 0, revenue: 0, conversions: 0, ads: 0 }
      }
      acc[device].spend += ad.spend || 0
      acc[device].revenue += ad.revenue || 0
      acc[device].conversions += ad.conversions || 0
      acc[device].ads += 1
      return acc
    }, {})
  ).map(([os, data]: [string, any]) => ({
    os,
    ...data,
    roas: data.spend > 0 ? data.revenue / data.spend : 0
  })).sort((a, b) => b.spend - a.spend)

  const extractWeek = (campaignName: string) => {
    const match = campaignName?.match(/(\d{4})Week(\d+)|W(\d+)/i)
    if (match) {
      const year = match[1] ? parseInt(match[1]) : 2025
      const week = parseInt(match[2] || match[3])
      return { year, week, weekKey: `${year}W${week.toString().padStart(2, '0')}` }
    }
    return null
  }

  const historicalData = Object.values(
    filteredAds.reduce((acc: any, ad) => {
      const weekInfo = extractWeek(ad.batch || ad.campaign_name || '')
      if (!weekInfo) return acc
      
      const weekKey = weekInfo.weekKey
      if (!acc[weekKey]) {
        acc[weekKey] = {
          week: weekKey,
          year: weekInfo.year,
          weekNum: weekInfo.week,
          sortKey: weekInfo.year * 100 + weekInfo.week,
          spend: 0,
          revenue: 0,
          ads: 0
        }
      }
      acc[weekKey].spend += ad.spend || 0
      acc[weekKey].revenue += ad.revenue || 0
      acc[weekKey].ads += 1
      return acc
    }, {})
  ).sort((a: any, b: any) => a.sortKey - b.sortKey)

  const SortIcon = ({ field }: { field: string }) => (
    <svg 
      className={`w-4 h-4 inline ml-1 ${sortField === field ? 'text-cyan-600' : 'text-gray-400'}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortField === field && sortDirection === 'asc' ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
    </svg>
  )

  const dateRangePresets: { label: string; value: DateRangeOption; available: boolean }[] = [
    { label: 'Today', value: 'today', available: true },
    { label: 'Yesterday', value: 'yesterday', available: true },
    { label: 'Last 7 days', value: 'last_7d', available: true },
    { label: 'Last 14 days', value: 'last_14d', available: true },
    { label: 'Last 28 days', value: 'last_28d', available: true },
    { label: 'Last 30 days', value: 'last_30d', available: true },
    { label: 'This week', value: 'this_week', available: true },
    { label: 'Last week', value: 'last_week', available: true },
    { label: 'This month', value: 'this_month', available: true },
    { label: 'Last month', value: 'last_month', available: true },
  ]

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

        {/* Date Range Picker */}
        <div className="mb-4">
          <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
             Date Range
          </label>
          
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`w-full px-4 py-3 text-left rounded-lg border flex items-center justify-between ${
                isDark ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600' : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
              } transition-colors`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">{getDateRangeLabel(filters.dateRange)}</span>
              </div>
              <svg className={`w-5 h-5 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDatePicker && (
              <div className={`absolute z-50 mt-2 w-96 rounded-xl shadow-2xl border ${
                isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                <div className="p-4">
                  <div className={`text-sm font-semibold mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Recently used
                  </div>
                  
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {dateRangePresets.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => {
                          if (preset.available) {
                            setFilters({...filters, dateRange: preset.value})
                            setShowDatePicker(false)
                          }
                        }}
                        disabled={!preset.available}
                        className={`w-full px-3 py-2.5 rounded-lg text-left flex items-center gap-3 transition-colors ${
                          filters.dateRange === preset.value
                            ? 'bg-cyan-600 text-white'
                            : preset.available
                            ? isDark 
                              ? 'hover:bg-gray-700 text-gray-300' 
                              : 'hover:bg-gray-50 text-gray-700'
                            : isDark
                            ? 'text-gray-600 cursor-not-allowed'
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          filters.dateRange === preset.value
                            ? 'border-white'
                            : isDark ? 'border-gray-600' : 'border-gray-300'
                        }`}>
                          {filters.dateRange === preset.value && (
                            <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                          )}
                        </div>
                        <span className="flex-1">{preset.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className={`mt-4 p-3 rounded-lg text-xs ${isDark ? 'bg-gray-900/50 text-gray-400' : 'bg-blue-50 text-blue-700'}`}>
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <div className="font-semibold mb-1">Data Availability:</div>
                        <div>• Last 7 days: Uses _7d columns</div>
                        <div>• Last 14 days: Uses _prev columns</div>
                        <div>• Last 28 days: Uses _28d columns</div>
                        <div>• Last 30 days: Uses _30d columns</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
             Currently showing: <span className="font-semibold text-cyan-600">{getDateRangeLabel(filters.dateRange)}</span>
          </div>
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
          
          {/*  UPDATED: Multi-select Persona filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Persona {filters.persona.length > 0 && <span className="text-cyan-600">({filters.persona.length} selected)</span>}
            </label>
            <select 
              multiple 
              value={filters.persona} 
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value)
                setFilters({...filters, persona: selected})
              }}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              size={4}
            >
              {personaOptions.filter(p => p !== 'All').map(p => (
                <option key={p} value={p} className={filters.persona.includes(p) ? 'bg-cyan-600 text-white' : ''}>
                  {p}
                </option>
              ))}
            </select>
            <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              Hold Ctrl/Cmd to select multiple
            </div>
          </div>
          
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Concept {filters.concept.length > 0 && <span className="text-cyan-600">({filters.concept.length} selected)</span>}
            </label>
            <select 
              multiple 
              value={filters.concept} 
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value)
                setFilters({...filters, concept: selected})
              }}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              size={4}
            >
              {conceptOptions.filter(c => c !== 'All').map(c => (
                <option key={c} value={c} className={filters.concept.includes(c) ? 'bg-cyan-600 text-white' : ''}>
                  {c}
                </option>
              ))}
            </select>
            <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              Hold Ctrl/Cmd to select multiple
            </div>
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
            Showing <span className="font-semibold text-cyan-600">{sortedAds.length}</span> ads across{' '}
            <span className="font-semibold text-cyan-600">{filteredCampaignCount}</span> 
            {filteredCampaignCount !== totalCampaignCount && (
              <span> of <span className="font-semibold">{totalCampaignCount}</span></span>
            )} campaigns
            {filters.persona.length > 0 && <span className="ml-2 text-cyan-600">• {filters.persona.length} persona(s) filtered</span>}
            {filters.concept.length > 0 && <span className="ml-2 text-cyan-600">• {filters.concept.length} concept(s) filtered</span>}
          </div>
          <div className="flex items-center gap-2">
            {ads.length >= 50000 && (
              <div className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/50' : 'bg-yellow-100 text-yellow-700 border border-yellow-300'}`}>
                 Data limit reached - some campaigns may be missing
              </div>
            )}
            <button onClick={() => setFilters({ campaign: 'All', device: 'All', country: 'All', persona: [], concept: [], status: 'All', minSpend: 0, dateRange: 'last_7d' })}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              Clear Filters
            </button>
          </div>
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

      {/* Spend vs ROAS Bar Chart */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Spend vs ROAS by Concept
        </h3>
        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={conceptPerformance} margin={{ bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
            <XAxis 
              dataKey="concept" 
              stroke={isDark ? '#9CA3AF' : '#6B7280'}
              angle={-60}
              textAnchor="end"
              height={120}
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis 
              yAxisId="left"
              stroke={isDark ? '#9CA3AF' : '#6B7280'}
              label={{ value: 'Spend ($)', angle: -90, position: 'insideLeft' }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="#10B981"
              label={{ value: 'ROAS', angle: 90, position: 'insideRight' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF', 
                border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="spend" fill="#06B6D4" name="Spend ($)" />
            <Bar yAxisId="right" dataKey="roas" fill="#10B981" name="ROAS" />
          </BarChart>
        </ResponsiveContainer>
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
             Showing weekly spend and revenue - not cumulative
          </div>
        </div>
      )}

      {/* Top Performing Concepts Chart */}
      <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Top 10 Concepts - Spend vs Revenue</h3>
        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={conceptPerformance} layout="horizontal" margin={{ bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
            <XAxis 
              type="category" 
              dataKey="concept" 
              stroke={isDark ? '#9CA3AF' : '#6B7280'} 
              angle={-60} 
              textAnchor="end" 
              height={120}
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis type="number" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
            <Tooltip contentStyle={{ backgroundColor: isDark ? '#1F2937' : '#FFFFFF', border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`, borderRadius: '8px' }} />
            <Legend />
            <Bar dataKey="spend" fill="#06B6D4" name="Spend ($)" />
            <Bar dataKey="revenue" fill="#10B981" name="Revenue ($)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Performance by OS/Device */}
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

      {/* Concept Performance Summary */}
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

                    {isExpanded && Object.entries(campaign.concepts).map(([conceptName, conceptAds]: [string, any]) => {
                      const conceptSpend = conceptAds.reduce((sum: number, ad: any) => sum + (ad.spend || 0), 0)
                      const conceptRevenue = conceptAds.reduce((sum: number, ad: any) => sum + (ad.revenue || 0), 0)
                      const conceptConversions = conceptAds.reduce((sum: number, ad: any) => sum + (ad.conversions || 0), 0)
                      const conceptRoas = conceptSpend > 0 ? conceptRevenue / conceptSpend : 0

                      return (
                        <React.Fragment key={`${campaign.campaign_name}-${conceptName}`}>
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

                          {conceptAds.sort((a: any, b: any) => (b.spend || 0) - (a.spend || 0)).map((ad: any) => (
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
                              <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>${safeNumber(ad.spend, 0)}</td>
                              <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>${safeNumber(ad.revenue, 0)}</td>
                              <td className={`px-4 py-2 text-sm text-right ${ad.roas >= 2 ? 'text-green-600' : ad.roas >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {safeNumber(ad.roas, 2)}x
                              </td>
                              <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{ad.conversions || 0}</td>
                              <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>${safeNumber((ad.impressions > 0 ? (ad.spend / ad.impressions) * 1000 : 0), 2)}</td>
                              <td className={`px-4 py-2 text-sm text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{safeNumber((ad.impressions > 0 ? (ad.clicks / ad.impressions) : 0) * 100, 2)}%</td>
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