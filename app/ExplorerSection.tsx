'use client'
import { useState } from 'react'

type SortField = 'ad_name' | 'spend_7d' | 'roas_7d' | 'ctr_7d' | 'conversions_7d'
type SortDirection = 'asc' | 'desc'

export default function ExplorerSection({ ads, loading, isDark }: { ads: any[], loading: boolean, isDark?: boolean }) {
  const [sortField, setSortField] = useState<SortField>('spend_7d')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  if (loading) {
    return (
      <div className={`rounded-xl shadow p-12 text-center ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>Loading data...</div>
      </div>
    )
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortedAds = [...ads].sort((a, b) => {
    let aVal = a[sortField]
    let bVal = b[sortField]

    if (sortField !== 'ad_name') {
      aVal = parseFloat(aVal || 0)
      bVal = parseFloat(bVal || 0)
    }

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })

  const getStatusBadge = (status: string) => {
    const styles = {
      'winning': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'contender': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'fatigued': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'not-performing': 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
    }
    
    const labels = {
      'winning': '🏆 Winning',
      'contender': '🎯 Contender',
      'fatigued': '🔥 Fatigued',
      'not-performing': '⚠️ Not Performing'
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  return (
    <div className={`rounded-xl shadow-lg overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={isDark ? 'bg-gray-900 text-gray-200' : 'bg-[#140D4F] text-white'}>
            <tr>
              <SortableHeader
                label="Status"
                field="ad_name"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
                isDark={isDark}
              />
              <SortableHeader
                label="Ad Name"
                field="ad_name"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
                isDark={isDark}
              />
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">
                Platform
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">
                Concept
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">
                Persona
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">
                Batch
              </th>
              <SortableHeader
                label="Spend (7d)"
                field="spend_7d"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
                align="right"
                isDark={isDark}
              />
              <SortableHeader
                label="ROAS"
                field="roas_7d"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
                align="right"
                isDark={isDark}
              />
              <SortableHeader
                label="CTR"
                field="ctr_7d"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
                align="right"
                isDark={isDark}
              />
              <SortableHeader
                label="Conversions"
                field="conversions_7d"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
                align="right"
                isDark={isDark}
              />
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
            {sortedAds.map((ad, idx) => (
              <tr 
                key={ad.id} 
                className={`transition-colors ${
                  isDark 
                    ? 'hover:bg-gray-700' 
                    : 'hover:bg-gray-50'
                } ${idx % 2 === 0 ? (isDark ? 'bg-gray-800' : 'bg-white') : (isDark ? 'bg-gray-750' : 'bg-gray-50/50')}`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(ad.performance_status)}
                </td>
                <td className={`px-6 py-4 text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                  <div className="max-w-xs truncate">{ad.ad_name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    ad.platform === 'meta' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 
                    ad.platform === 'tiktok' ? 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' : 
                    ad.platform === 'google' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {ad.platform}
                  </span>
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {ad.concept_code || '-'}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {ad.persona || '-'}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {ad.batch || '-'}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                  ${parseFloat(ad.spend_7d || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right`}>
                  <span className={parseFloat(ad.roas_7d || 0) >= 2.0 ? 'text-green-600' : (isDark ? 'text-gray-200' : 'text-gray-900')}>
                    {parseFloat(ad.roas_7d || 0).toFixed(2)}x
                  </span>
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                  {(parseFloat(ad.ctr_7d || 0) * 100).toFixed(2)}%
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                  {parseInt(ad.conversions_7d || 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {ads.length === 0 && (
        <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          No ads found matching your filters
        </div>
      )}

      {/* Summary Footer */}
      {ads.length > 0 && (
        <div className={`px-6 py-4 flex justify-between items-center text-sm ${isDark ? 'bg-gray-750 text-gray-300' : 'bg-gray-50 text-gray-700'}`}>
          <div>
            Showing {sortedAds.length} ads
          </div>
          <div className="flex gap-6">
            <div>
              Total Spend: <span className={`font-semibold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                ${sortedAds.reduce((sum, ad) => sum + parseFloat(ad.spend_7d || 0), 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
              </span>
            </div>
            <div>
              Total Conversions: <span className={`font-semibold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                {sortedAds.reduce((sum, ad) => sum + parseInt(ad.conversions_7d || 0), 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SortableHeader({ 
  label, 
  field, 
  currentField, 
  direction, 
  onSort,
  align = 'left',
  isDark
}: {
  label: string
  field: SortField
  currentField: SortField
  direction: SortDirection
  onSort: (field: SortField) => void
  align?: 'left' | 'right'
  isDark?: boolean
}) {
  const isActive = currentField === field
  
  return (
    <th 
      className={`px-6 py-4 text-xs font-medium uppercase tracking-wider cursor-pointer transition-colors ${
        isDark ? 'hover:bg-gray-800' : 'hover:bg-[#1a1159]'
      } ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        <span>{label}</span>
        <span className="text-cyan-400">
          {isActive ? (direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </div>
    </th>
  )
}