'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { exportToCSV } from '../lib/csvExport'

export default function AudiencesPage({ isDark }: { isDark?: boolean }) {
  const [audiences, setAudiences] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // CSV Export Function
  const handleExportCSV = () => {
    exportToCSV(
      audiences,
      'audiences_by_persona',
      [
        { key: 'persona', label: 'Persona' },
        { key: 'ads', label: 'Number of Ads' },
        { key: 'spend', label: 'Spend ($)' },
        { key: 'impressions', label: 'Impressions' },
        { key: 'clicks', label: 'Clicks' },
        { key: 'ctr', label: 'CTR (%)' },
        { key: 'conversions', label: 'Conversions' },
        { key: 'conversionRate', label: 'Conversion Rate (%)' },
        { key: 'avgRoas', label: 'Avg ROAS' }
      ]
    )
  }

  useEffect(() => {
    fetchAudiences()
  }, [])

  async function fetchAudiences() {
    setLoading(true)
    
    try {
      const { data, error } = await supabase
        .from('creative_performance')
        .select('*')
        .eq('status', 'ACTIVE')

      if (error) {
        console.error('Error fetching audiences:', error)
        setLoading(false)
        return
      }

      if (data) {
        const grouped = groupByPersona(data)
        setAudiences(grouped)
      }
    } catch (err) {
      console.error('Error:', err)
    }
    
    setLoading(false)
  }

  function groupByPersona(data: any[]) {
    const personas: any = {}
    
    data.forEach(ad => {
      const persona = ad.persona || 'Unknown'
      if (!personas[persona]) {
        personas[persona] = {
          persona,
          ads: 0,
          spend: 0,
          conversions: 0,
          impressions: 0,
          clicks: 0,
          avgRoas: 0
        }
      }
      personas[persona].ads += 1
      personas[persona].spend += parseFloat(ad.spend_7d || 0)
      personas[persona].conversions += parseInt(ad.conversions_7d || 0)
      personas[persona].impressions += parseInt(ad.impressions_7d || 0)
      personas[persona].clicks += parseInt(ad.clicks_7d || 0)
      personas[persona].avgRoas += parseFloat(ad.roas_7d || 0)
    })
    
    Object.values(personas).forEach((p: any) => {
      p.avgRoas = p.avgRoas / p.ads
      p.ctr = p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0
      p.conversionRate = p.impressions > 0 ? (p.conversions / p.impressions) * 100 : 0
    })
    
    return Object.values(personas).sort((a: any, b: any) => b.spend - a.spend)
  }

  return (
    <div>
      {loading ? (
        <div className={`rounded-xl p-12 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            <span className={`ml-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Loading audiences...</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-6">
            <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Personas</div>
              <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{audiences.length}</div>
            </div>
            <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Ads</div>
              <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {audiences.reduce((sum, a) => sum + a.ads, 0)}
              </div>
            </div>
            <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Spend</div>
              <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ${audiences.reduce((sum, a) => sum + a.spend, 0).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
              </div>
            </div>
            <div className={`rounded-xl p-6 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Conversions</div>
              <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {audiences.reduce((sum, a) => sum + a.conversions, 0).toLocaleString()}
              </div>
            </div>
          </div>

           {/* Personas Table */}
          <div className={`rounded-xl shadow-sm border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Performance by Persona</h3>
                <button onClick={handleExportCSV}
                  className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 bg-cyan-600 text-white hover:bg-cyan-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Persona</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Ads</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Spend</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Impressions</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>CTR</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Conversions</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Conv. Rate</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Avg. ROAS</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {audiences.map((audience, index) => (
                    <tr key={index} className={isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-semibold">
                            {audience.persona.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="ml-3">
                            <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{audience.persona}</div>
                          </div>
                        </div>
                      </td>
                      <td className={`px-6 py-4 text-sm text-right ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{audience.ads}</td>
                      <td className={`px-6 py-4 text-sm text-right font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                        ${audience.spend.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                      <td className={`px-6 py-4 text-sm text-right ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                        {audience.impressions.toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 text-sm text-right ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                        {audience.ctr.toFixed(2)}%
                      </td>
                      <td className={`px-6 py-4 text-sm text-right ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                        {audience.conversions.toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 text-sm text-right ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                        {audience.conversionRate.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 text-sm text-right">
                        <span className={`font-medium ${
                          audience.avgRoas > 2.0 ? 'text-green-600' :
                          audience.avgRoas > 1.0 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {audience.avgRoas.toFixed(2)}x
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Insights */}
          <div className="grid grid-cols-2 gap-6">
            <div className={`rounded-xl p-6 border ${
              isDark 
                ? 'bg-gradient-to-br from-green-900 to-green-800 border-green-700' 
                : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
            }`}>
              <div className="text-4xl mb-3">🏆</div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Top Performer</h3>
              {audiences.length > 0 && (
                <div>
                  <p className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{audiences[0].persona}</p>
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    ${audiences[0].spend.toLocaleString()} spend • {audiences[0].avgRoas.toFixed(2)}x ROAS
                  </p>
                </div>
              )}
            </div>
            
            <div className={`rounded-xl p-6 border ${
              isDark 
                ? 'bg-gradient-to-br from-blue-900 to-blue-800 border-blue-700' 
                : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
            }`}>
              <div className="text-4xl mb-3">💡</div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Recommendation</h3>
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Focus more budget on high-performing personas with ROAS &gt; 2.0x
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}