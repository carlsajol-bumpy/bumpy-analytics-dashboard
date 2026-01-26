'use client'
import { useState } from 'react'
import Image from 'next/image'
import AnalyticsPageEnhanced from './AnalyticsPage'
import InsightsSection from './InsightsSection'
import ExplorerSection from './ExplorerSection'
import AudiencesPage from './AudiencesPage'
import SettingsPage from './SettingsPage'
import AlertSystem from './AlertSystem'
import CampaignLevelView from './CampaignLevelView'
import AdSetLevelView from './AdSetLevelView'

export default function Home() {
  const [activeTab, setActiveTab] = useState('alerts')
  const [viewLevel, setViewLevel] = useState<'campaign' | 'adset' | 'creative'>('campaign')
  const [isDark, setIsDark] = useState(true)

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-52 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-r`}>
        <div className="p-6">
          {/* Logo Section - FIXED */}
          <div className="flex items-center gap-3 mb-8">
            <Image 
              src="/bumpy-logo.png"
              alt="Bumpy Logo" 
              width={40} 
              height={40}
              className="rounded-lg"
            />
            <div>
              <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Bumpy</h1>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Analytics Pro</p>
            </div>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab('alerts')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                activeTab === 'alerts'
                  ? isDark ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-700'
                  : isDark ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="text-sm font-medium">Alerts</span>
            </button>

            <button
              onClick={() => setActiveTab('insights')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                activeTab === 'insights'
                  ? isDark ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-700'
                  : isDark ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm font-medium">Insights</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                activeTab === 'analytics'
                  ? isDark ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-700'
                  : isDark ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-sm font-medium">Analytics</span>
            </button>

            {/* Performance Section */}
            <div className="pt-4">
              <div className={`px-4 py-2 text-xs font-semibold uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Performance
              </div>
              
              <button
                onClick={() => { setActiveTab('performance'); setViewLevel('campaign') }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'performance' && viewLevel === 'campaign'
                    ? isDark ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-700'
                    : isDark ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="text-sm font-medium">Campaigns</span>
              </button>

              <button
                onClick={() => { setActiveTab('performance'); setViewLevel('adset') }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'performance' && viewLevel === 'adset'
                    ? isDark ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-700'
                    : isDark ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span className="text-sm font-medium">Ad Sets</span>
              </button>

              <button
                onClick={() => { setActiveTab('performance'); setViewLevel('creative') }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'performance' && viewLevel === 'creative'
                    ? isDark ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-700'
                    : isDark ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                <span className="text-sm font-medium">Creatives</span>
              </button>
            </div>

            <button
              onClick={() => setActiveTab('audiences')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                activeTab === 'audiences'
                  ? isDark ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-700'
                  : isDark ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-sm font-medium">Audiences</span>
            </button>

            <button
              onClick={() => setActiveTab('explorer')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                activeTab === 'explorer'
                  ? isDark ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-700'
                  : isDark ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium">Explorer</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                activeTab === 'settings'
                  ? isDark ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-700'
                  : isDark ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-medium">Settings</span>
            </button>
          </nav>
        </div>

        {/* Dark Mode Toggle */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <button
            onClick={() => setIsDark(!isDark)}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors ${
              isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {isDark ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
              <span className="text-sm font-medium">{isDark ? 'Dark' : 'Light'} Mode</span>
            </div>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-52 p-8">
        {activeTab === 'alerts' && (
          <div>
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Smart Alerts</h2>
                  <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    AI-powered performance monitoring with actionable recommendations
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-lg ${isDark ? 'bg-cyan-900/30 border border-cyan-700' : 'bg-cyan-50 border border-cyan-200'}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                    <span className={`text-sm font-medium ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>Live Monitoring</span>
                  </div>
                </div>
              </div>
            </div>
            <AlertSystem isDark={isDark} />
          </div>
        )}

        {activeTab === 'insights' && (
          <div>
            <div className="mb-6">
              <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Insights</h2>
              <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Deep insights into your campaigns</p>
            </div>
            <InsightsSection isDark={isDark} />
          </div>
        )}

        {activeTab === 'analytics' && <AnalyticsPageEnhanced isDark={isDark} />}

        {activeTab === 'performance' && (
          <div>
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {viewLevel === 'campaign' && 'Campaign Performance'}
                    {viewLevel === 'adset' && 'Ad Set Performance'}
                    {viewLevel === 'creative' && 'Creative Performance'}
                  </h2>
                  <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {viewLevel === 'campaign' && 'Campaign-level aggregated metrics with filters'}
                    {viewLevel === 'adset' && 'Ad set-level performance breakdown'}
                    {viewLevel === 'creative' && 'Individual ad creative performance'}
                  </p>
                </div>

                <div className={`flex items-center gap-2 p-1 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <button onClick={() => setViewLevel('campaign')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewLevel === 'campaign' ? 'bg-cyan-600 text-white' : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                    }`}>
                    Campaigns
                  </button>
                  <button onClick={() => setViewLevel('adset')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewLevel === 'adset' ? 'bg-cyan-600 text-white' : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                    }`}>
                    Ad Sets
                  </button>
                  <button onClick={() => setViewLevel('creative')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewLevel === 'creative' ? 'bg-cyan-600 text-white' : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                    }`}>
                    Creatives
                  </button>
                </div>
              </div>
            </div>

            {viewLevel === 'campaign' && <CampaignLevelView isDark={isDark} />}
            {viewLevel === 'adset' && <AdSetLevelView isDark={isDark} />}
            {viewLevel === 'creative' && <ExplorerSection isDark={isDark} />}
          </div>
        )}

        {activeTab === 'audiences' && (
          <div>
            <div className="mb-6">
              <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Audiences</h2>
              <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Manage your audience segments</p>
            </div>
            <AudiencesPage isDark={isDark} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div>
            <div className="mb-6">
              <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
              <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Configure your dashboard</p>
            </div>
            <SettingsPage isDark={isDark} />
          </div>
        )}

        {activeTab === 'explorer' && (
          <div>
            <div className="mb-6">
              <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Explorer</h2>
              <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Explore all your ads in detail</p>
            </div>
            <ExplorerSection isDark={isDark} />
          </div>
        )}
      </div>
    </div>
  )
}