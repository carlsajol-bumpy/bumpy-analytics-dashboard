'use client'
import { useState, useEffect } from 'react'

export default function InsightsSection({ ads, loading, isDark: parentIsDark }: { ads: any[], loading: boolean, isDark?: boolean }) {
  // Use parent's dark mode state if provided, otherwise manage own state
  const [localIsDark, setLocalIsDark] = useState(false)
  const isDark = parentIsDark !== undefined ? parentIsDark : localIsDark

  useEffect(() => {
    if (parentIsDark === undefined) {
      const savedTheme = localStorage.getItem('theme')
      if (savedTheme === 'dark') {
        setLocalIsDark(true)
      } else if (savedTheme === 'light') {
        setLocalIsDark(false)
      } else {
        setLocalIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
      }
    }
  }, [])

  const toggleDarkMode = () => {
    if (parentIsDark === undefined) {
      const newDark = !localIsDark
      setLocalIsDark(newDark)
      localStorage.setItem('theme', newDark ? 'dark' : 'light')
    }
  }

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

  // Calculate insights
  const winningAds = ads.filter(ad => ad.isWinning)
  const fatiguedAds = ads.filter(ad => ad.isFatigued)
  const contenderAds = ads.filter(ad => ad.performance_status === 'contender')
  const notPerformingAds = ads.filter(ad => ad.performance_status === 'not-performing')
  
  const topAdsByRoas = [...ads]
    .filter(ad => parseFloat(ad.roas_7d || 0) > 0)
    .sort((a, b) => parseFloat(b.roas_7d || 0) - parseFloat(a.roas_7d || 0))
    .slice(0, 5)
  
  const videoAds = ads.filter(ad => ad.media_type === 'video')
  const bestVideoAds = [...videoAds]
    .filter(ad => parseFloat(ad.hook_rate_7d || 0) > 0)
    .sort((a, b) => {
      const engagementA = (parseFloat(a.hook_rate_7d || 0) + parseFloat(a.hold_rate_7d || 0)) / 2
      const engagementB = (parseFloat(b.hook_rate_7d || 0) + parseFloat(b.hold_rate_7d || 0)) / 2
      return engagementB - engagementA
    })
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Performance Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          title="Winning"
          count={winningAds.length}
          color="blue"
          icon={<TrophyIcon />}
          isDark={isDark}
        />
        <SummaryCard
          title="Contenders"
          count={contenderAds.length}
          color="cyan"
          icon={<StarIcon />}
          isDark={isDark}
        />
        <SummaryCard
          title="Fatigued"
          count={fatiguedAds.length}
          color="orange"
          icon={<AlertIcon />}
          isDark={isDark}
        />
        <SummaryCard
          title="Not Performing"
          count={notPerformingAds.length}
          color="gray"
          icon={<TrendDownIcon />}
          isDark={isDark}
        />
      </div>

      {/* Top Performing Ads & Best Videos */}
      <div className="grid grid-cols-2 gap-6">
        {/* Top ROAS Ads */}
        <div className={`rounded-xl shadow-sm border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <SparklesIcon isDark={isDark} />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Top Performing Ads</h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Highest ROAS in last 7 days</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-blue-600">{topAdsByRoas.length}</span>
            </div>
          </div>
          <div className="p-6">
            {topAdsByRoas.length === 0 ? (
              <p className={`text-center py-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No high-performing ads yet</p>
            ) : (
              <div className="space-y-3">
                {topAdsByRoas.map((ad, index) => (
                  <div key={ad.ad_id || index} className={`border rounded-lg p-4 transition-colors ${
                    isDark 
                      ? 'border-gray-700 hover:border-blue-600 bg-gray-750' 
                      : 'border-gray-200 hover:border-blue-300 bg-white'
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{ad.ad_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-600 text-white">
                            {ad.concept_code}
                          </span>
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{ad.persona}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                        ROAS: <span className="font-bold text-green-600">{parseFloat(ad.roas_7d).toFixed(2)}x</span>
                      </span>
                      <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                        Spend: <span className="font-semibold">${parseFloat(ad.spend_7d).toFixed(0)}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Best Video Ads */}
        <div className={`rounded-xl shadow-sm border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900">
                  <VideoIcon isDark={isDark} />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Best Video Ads</h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Highest engagement rates</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-cyan-600">{bestVideoAds.length}</span>
            </div>
          </div>
          <div className="p-6">
            {bestVideoAds.length === 0 ? (
              <p className={`text-center py-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No video ads with engagement data</p>
            ) : (
              <div className="space-y-3">
                {bestVideoAds.map((ad, index) => (
                  <div key={ad.ad_id || index} className={`border rounded-lg p-4 transition-colors ${
                    isDark 
                      ? 'border-gray-700 hover:border-cyan-600 bg-gray-750' 
                      : 'border-gray-200 hover:border-cyan-300 bg-white'
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{ad.ad_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded font-medium bg-cyan-600 text-white">
                            {ad.concept_code}
                          </span>
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{ad.persona}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                        Hook: <span className="font-semibold">{(parseFloat(ad.hook_rate_7d || 0) * 100).toFixed(1)}%</span>
                      </span>
                      <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                        Hold: <span className="font-semibold">{(parseFloat(ad.hold_rate_7d || 0) * 100).toFixed(1)}%</span>
                      </span>
                      <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                        Spend: <span className="font-semibold">${parseFloat(ad.spend_7d).toFixed(0)}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attention Needed */}
      <div className="grid grid-cols-2 gap-6">
        {/* Fatigued Ads */}
        <div className={`rounded-xl shadow-sm border-2 overflow-hidden ${
          isDark 
            ? 'bg-gray-800 border-orange-600' 
            : 'bg-white border-orange-300'
        }`}>
          <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-orange-900' : 'bg-orange-100'}`}>
                  <AlertTriangleIcon isDark={isDark} />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Fatigued Ads</h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Low performance despite spending</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-orange-600">{fatiguedAds.length}</span>
            </div>
          </div>
          <div className="p-6">
            {fatiguedAds.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center bg-green-100">
                  <CheckIcon />
                </div>
                <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>No fatigued ads - Great job!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fatiguedAds.slice(0, 3).map((ad, index) => (
                  <div key={ad.ad_id || index} className={`border rounded-lg p-4 ${
                    isDark 
                      ? 'border-orange-700 bg-gray-750' 
                      : 'border-orange-200 bg-orange-50'
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{ad.ad_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {ad.concept_code}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                        ROAS: <span className="font-bold text-orange-600">{parseFloat(ad.roas_7d).toFixed(2)}x</span>
                      </span>
                      <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                        Spend: <span className="font-semibold">${parseFloat(ad.spend_7d).toFixed(0)}</span>
                      </span>
                      <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                        CTR: <span className="font-semibold">{(parseFloat(ad.ctr_7d || 0) * 100).toFixed(2)}%</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Not Performing Ads */}
        <div className={`rounded-xl shadow-sm border-2 overflow-hidden ${
          isDark 
            ? 'bg-gray-800 border-gray-600' 
            : 'bg-white border-gray-300'
        }`}>
          <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <XCircleIcon isDark={isDark} />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Not Performing</h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Consider pausing these ads</p>
                </div>
              </div>
              <span className={`text-2xl font-bold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{notPerformingAds.length}</span>
            </div>
          </div>
          <div className="p-6">
            {notPerformingAds.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center bg-green-100">
                  <CheckIcon />
                </div>
                <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>All ads performing well!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notPerformingAds.slice(0, 3).map((ad, index) => (
                  <div key={ad.ad_id || index} className={`border rounded-lg p-4 ${
                    isDark 
                      ? 'border-gray-700 bg-gray-750' 
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{ad.ad_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {ad.concept_code}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                        ROAS: <span className="font-bold">{parseFloat(ad.roas_7d).toFixed(2)}x</span>
                      </span>
                      <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                        Spend: <span className="font-semibold">${parseFloat(ad.spend_7d).toFixed(0)}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ title, count, color, icon, isDark }: {
  title: string
  count: number
  color: 'blue' | 'cyan' | 'orange' | 'gray'
  icon: React.ReactNode
  isDark: boolean
}) {
  const colorStyles = {
    blue: isDark ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-200',
    cyan: isDark ? 'bg-cyan-900 border-cyan-700' : 'bg-cyan-50 border-cyan-200',
    orange: isDark ? 'bg-orange-900 border-orange-700' : 'bg-orange-50 border-orange-200',
    gray: isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'
  }

  const textColor = color === 'gray' 
    ? (isDark ? 'text-gray-300' : 'text-gray-700')
    : 'text-white'

  return (
    <div className={`rounded-xl p-6 shadow-sm border ${colorStyles[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          {icon}
        </div>
        <span className={`text-3xl font-bold ${
          color === 'blue' ? 'text-blue-600' :
          color === 'cyan' ? 'text-cyan-600' :
          color === 'orange' ? 'text-orange-600' :
          isDark ? 'text-gray-400' : 'text-gray-600'
        }`}>
          {count}
        </span>
      </div>
      <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
        {title}
      </h3>
    </div>
  )
}

// Icon components with proper colors
function TrophyIcon() {
  return (
    <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
      <path d="M4 22h16"></path>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
    </svg>
  )
}

function StarIcon() {
  return (
    <svg className="w-6 h-6 text-cyan-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  )
}

function TrendDownIcon() {
  return (
    <svg className="w-6 h-6 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
      <polyline points="17 18 23 18 23 12"></polyline>
    </svg>
  )
}

function SparklesIcon({ isDark }: { isDark: boolean }) {
  return (
    <svg className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
    </svg>
  )
}

function VideoIcon({ isDark }: { isDark: boolean }) {
  return (
    <svg className={`w-6 h-6 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="23 7 16 12 23 17 23 7"></polygon>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
    </svg>
  )
}

function AlertTriangleIcon({ isDark }: { isDark: boolean }) {
  return (
    <svg className={`w-6 h-6 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  )
}

function XCircleIcon({ isDark }: { isDark: boolean }) {
  return (
    <svg className={`w-6 h-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  )
}