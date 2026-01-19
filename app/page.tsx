'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import InsightsSection from './InsightsSection'
import ExplorerSection from './ExplorerSection'
import AnalyticsPage from './AnalyticsPage'
import AudiencesPage from './AudiencesPage'
import SettingsPage from './SettingsPage'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalSpend: 0,
    avgRoas: 0,
    activeAds: 0,
    conversions: 0,
    impressions: 0,
    clicks: 0
  })
  const [ads, setAds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activePage, setActivePage] = useState<'overview' | 'insights' | 'analytics' | 'audiences' | 'settings'>('overview')
  const [activeTab, setActiveTab] = useState<'explorer' | 'insights'>('explorer')
  const [isDark, setIsDark] = useState(false)
  const [filters, setFilters] = useState({
    platform: 'All',
    concept: 'All',
    persona: 'All',
    dateRange: '7'
  })

  useEffect(() => {
    // Load theme preference
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setIsDark(true)
      document.documentElement.classList.add('dark')
    } else if (savedTheme === 'light') {
      setIsDark(false)
      document.documentElement.classList.remove('dark')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setIsDark(prefersDark)
      if (prefersDark) document.documentElement.classList.add('dark')
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [filters])

  const toggleDarkMode = () => {
    const newDark = !isDark
    setIsDark(newDark)
    localStorage.setItem('theme', newDark ? 'dark' : 'light')
    if (newDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  async function fetchData() {
    setLoading(true)
    
    try {
      let query = supabase
        .from('creative_performance')
        .select('*')
        .eq('status', 'ACTIVE')

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

      if (error) {
        console.error('Supabase error:', error)
        setLoading(false)
        return
      }

      if (data) {
        const enrichedAds = data.map(ad => ({
          ...ad,
          batch: ad.batch || '-',
          language: ad.language || '-',
          media_type: ad.media_type || 'video',
          budget: parseFloat(ad.budget || 0),
          hook_rate_7d: parseFloat(ad.hook_rate_7d || 0),
          hold_rate_7d: parseFloat(ad.hold_rate_7d || 0),
          conversion_rate_7d: parseFloat(ad.conversion_rate_7d || 0),
          created_at: ad.created_at || new Date().toISOString(),
          performance_status: classifyAdStatus(ad),
          isWinning: isWinningAd(ad),
          isFatigued: isFatiguedAd(ad)
        }))
        
        setAds(enrichedAds)
        
        const totalSpend = enrichedAds.reduce((sum: number, ad: any) => 
          sum + parseFloat(ad.spend_7d || 0), 0)
        const avgRoas = enrichedAds.length > 0 
          ? enrichedAds.reduce((sum: number, ad: any) => 
              sum + parseFloat(ad.roas_7d || 0), 0) / enrichedAds.length 
          : 0
        const conversions = enrichedAds.reduce((sum: number, ad: any) => 
          sum + parseInt(ad.conversions_7d || 0), 0)
        const impressions = enrichedAds.reduce((sum: number, ad: any) => 
          sum + parseInt(ad.impressions_7d || 0), 0)
        const clicks = enrichedAds.reduce((sum: number, ad: any) => 
          sum + parseInt(ad.clicks_7d || 0), 0)
        
        setStats({
          totalSpend,
          avgRoas,
          activeAds: enrichedAds.length,
          conversions,
          impressions,
          clicks
        })
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    }
    
    setLoading(false)
  }

  function isWinningAd(ad: any): boolean {
    const spend = parseFloat(ad.spend_7d || 0)
    const roas = parseFloat(ad.roas_7d || 0)
    const ctr = parseFloat(ad.ctr_7d || 0)
    const budget = parseFloat(ad.budget || spend * 0.8)

    if (spend > (budget * 1.5) && roas > 2.0 && ctr > 0.006) {
      return true
    }

    const hookRate = parseFloat(ad.hook_rate_7d || 0)
    const holdRate = parseFloat(ad.hold_rate_7d || 0)
    const conversionRate = parseFloat(ad.conversion_rate_7d || 0)

    if (hookRate > 0 || holdRate > 0) {
      return (
        spend > (budget * 1.5) &&
        ctr > 0.006 &&
        hookRate > 0.20 &&
        holdRate > 0.10 &&
        conversionRate > 0.03
      )
    }

    return false
  }

  function isFatiguedAd(ad: any): boolean {
    const roas = parseFloat(ad.roas_7d || 0)
    const spend = parseFloat(ad.spend_7d || 0)
    const ctr = parseFloat(ad.ctr_7d || 0)

    const isLowPerformance = roas < 1.0 && ctr < 0.005
    const stillSpending = spend > 100

    return isLowPerformance && stillSpending
  }

  function classifyAdStatus(ad: any): 'winning' | 'contender' | 'fatigued' | 'not-performing' {
    if (isWinningAd(ad)) return 'winning'
    if (isFatiguedAd(ad)) return 'fatigued'
    
    const spend = parseFloat(ad.spend_7d || 0)
    const roas = parseFloat(ad.roas_7d || 0)
    
    const createdDate = new Date(ad.created_at || Date.now())
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const isNew = createdDate > weekAgo
    
    if (isNew && roas > 1.5 && spend > 200) return 'contender'
    
    if (spend < 50 || roas < 0.5) return 'not-performing'
    
    return 'not-performing'
  }

  const platforms = ['All', ...new Set(ads.map(ad => ad.platform).filter(Boolean))]
  const concepts = ['All', ...new Set(ads.map(ad => ad.concept_code).filter(Boolean))]
  const personas = ['All', ...new Set(ads.map(ad => ad.persona).filter(Boolean))]

  return (
    <div className={`flex min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Sidebar */}
      <div className={`w-64 border-r ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div style={{ backgroundColor: '#44C8CD' }} className="w-10 h-10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div>
              <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Bumpy</h2>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Analytics</p>
            </div>
          </div>

          <nav className="space-y-1">
            <NavButton
              active={activePage === 'overview'}
              onClick={() => setActivePage('overview')}
              icon={<OverviewIcon />}
              label="Overview"
              isDark={isDark}
            />
            <NavButton
              active={activePage === 'insights'}
              onClick={() => setActivePage('insights')}
              icon={<InsightsIcon />}
              label="Insights"
              isDark={isDark}
            />
            <NavButton
              active={activePage === 'analytics'}
              onClick={() => setActivePage('analytics')}
              icon={<AnalyticsIcon />}
              label="Analytics"
              isDark={isDark}
            />
            <NavButton
              active={activePage === 'audiences'}
              onClick={() => setActivePage('audiences')}
              icon={<AudiencesIcon />}
              label="Audiences"
              isDark={isDark}
            />
            <NavButton
              active={activePage === 'settings'}
              onClick={() => setActivePage('settings')}
              icon={<SettingsIcon />}
              label="Settings"
              isDark={isDark}
            />
          </nav>

          {/* Dark Mode Toggle in Sidebar */}
          <div className={`mt-8 pt-8 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              onClick={toggleDarkMode}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isDark ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Light Mode
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  Dark Mode
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {activePage === 'overview' ? 'Dashboard' :
               activePage === 'insights' ? 'Insights' :
               activePage === 'analytics' ? 'Analytics' :
               activePage === 'audiences' ? 'Audiences' :
               'Settings'}
            </h1>
            <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {activePage === 'overview' ? "Welcome back, here's what's happening today." :
               activePage === 'insights' ? 'Deep insights into your campaign performance' :
               activePage === 'analytics' ? 'Advanced analytics and trends' :
               activePage === 'audiences' ? 'Understand your audience segments' :
               'Manage your dashboard settings'}
            </p>
          </div>

          {/* Content - Show different pages based on activePage */}
          {activePage === 'analytics' ? (
            <AnalyticsPage isDark={isDark} />
          ) : activePage === 'audiences' ? (
            <AudiencesPage isDark={isDark} />
          ) : activePage === 'settings' ? (
            <SettingsPage isDark={isDark} />
          ) : activePage === 'insights' ? (
            <InsightsSection ads={ads} loading={loading} isDark={isDark} />
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-6 mb-8">
                <StatCard 
                  label="Total Spend"
                  value={`$${stats.totalSpend.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`}
                  trend="+12.5%"
                  trendUp={true}
                  isDark={isDark}
                  icon={
                    <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
                <StatCard 
                  label="Impressions"
                  value={stats.impressions.toLocaleString()}
                  trend="+8.2%"
                  trendUp={true}
                  isDark={isDark}
                  icon={
                    <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  }
                />
                <StatCard 
                  label="Link Clicks"
                  value={stats.clicks.toLocaleString()}
                  trend="-2.4%"
                  trendUp={false}
                  isDark={isDark}
                  icon={
                    <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                  }
                />
                <StatCard 
                  label="ROAS"
                  value={`${stats.avgRoas.toFixed(2)}x`}
                  trend="+5.1%"
                  trendUp={true}
                  isDark={isDark}
                  icon={
                    <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  }
                />
              </div>

              {/* Filters */}
              <div className={`rounded-xl p-6 mb-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="grid grid-cols-4 gap-4">
                  <FilterSelect
                    label="Platform"
                    value={filters.platform}
                    onChange={(value) => setFilters({...filters, platform: value})}
                    options={platforms}
                    isDark={isDark}
                  />
                  <FilterSelect
                    label="Concept"
                    value={filters.concept}
                    onChange={(value) => setFilters({...filters, concept: value})}
                    options={concepts}
                    isDark={isDark}
                  />
                  <FilterSelect
                    label="Persona"
                    value={filters.persona}
                    onChange={(value) => setFilters({...filters, persona: value})}
                    options={personas}
                    isDark={isDark}
                  />
                  <div className="flex items-end">
                    <button className="w-full py-2.5 px-4 text-white rounded-lg font-medium hover:opacity-90 transition-opacity bg-cyan-600">
                      Apply Filters
                    </button>
                  </div>
                </div>
              </div>

              {/* Explorer/Insights Tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setActiveTab('explorer')}
                  className={`px-6 py-3 rounded-lg font-medium transition-all ${
                    activeTab === 'explorer'
                      ? 'bg-cyan-600 text-white'
                      : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Explorer
                </button>
                <button
                  onClick={() => setActiveTab('insights')}
                  className={`px-6 py-3 rounded-lg font-medium transition-all ${
                    activeTab === 'insights'
                      ? 'bg-cyan-600 text-white'
                      : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Insights
                </button>
              </div>

              {/* Content */}
              {activeTab === 'explorer' ? (
                <ExplorerSection ads={ads} loading={loading} isDark={isDark} />
              ) : (
                <InsightsSection ads={ads} loading={loading} isDark={isDark} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function NavButton({ active, onClick, icon, label, isDark }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  isDark: boolean
}) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        active 
          ? 'bg-cyan-600 text-white' 
          : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function StatCard({ label, value, trend, trendUp, icon, isDark }: {
  label: string
  value: string
  trend: string
  trendUp: boolean
  icon: React.ReactNode
  isDark: boolean
}) {
  return (
    <div className={`rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow ${
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {trendUp ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            )}
          </svg>
          {trend}
        </div>
      </div>
      <div className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{label}</div>
      <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</div>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options, isDark }: { 
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  isDark: boolean
}) {
  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{label}</label>
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all ${
          isDark 
            ? 'bg-gray-700 border-gray-600 text-white' 
            : 'bg-white border-gray-300 text-gray-900'
        }`}
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}

// Navigation Icons
function OverviewIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}

function InsightsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function AnalyticsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function AudiencesIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}