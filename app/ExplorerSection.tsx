'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { exportToCSV } from '../lib/csvExport'

interface ExplorerSectionProps {
  isDark?: boolean
}

export default function ExplorerSection({ isDark }: ExplorerSectionProps) {
  const [ads, setAds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState('updated_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  // Filters
  const [filters, setFilters] = useState({
    batch: 'All',
    week: 'All',
    persona: 'All',
    conceptCode: 'All',
    performanceCategory: 'All',
    status: 'All'
  })

  // CSV Export Function
  const handleExportCSV = () => {
    const filename = `explorer${filters.status !== 'All' ? `_${filters.status}` : ''}${filters.performanceCategory !== 'All' ? `_${filters.performanceCategory}` : ''}`
    
    exportToCSV(
      sortedAds,
      filename,
      [
        { key: 'status', label: 'Status' },
        { key: 'concept_code', label: 'Concept' },
        { key: 'persona', label: 'Persona' },
        { key: 'batch', label: 'Batch' },
        { key: 'spend_7d', label: 'Spend ($)' },
        { key: 'roas_7d', label: 'ROAS' },
        { key: 'ctr_7d', label: 'CTR' },
        { key: 'cpc', label: 'CPC ($)' },
        { key: 'impressions_7d', label: 'Impressions' },
        { key: 'clicks_7d', label: 'Clicks' },
        { key: 'conversions_7d', label: 'Conversions' },
        { key: 'performance_category', label: 'Performance Category' }
      ]
    )
  }

  useEffect(() => {
    fetchAds()
  }, [])

  async function fetchAds() {
    setLoading(true)
    
    // Get ALL ads (ACTIVE + PAUSED) - explicitly set high limit
    const { data, error, count } = await supabase
      .from('creative_performance')
      .select('*', { count: 'exact' })
      .order(sortField, { ascending: sortDirection === 'asc' })
      .limit(10000)

    console.log('🔍 Explorer: Fetched', data?.length, 'ads. Total in DB:', count)

    if (error) {
      console.error('Error:', error)
    } else {
      setAds(data || [])
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

  function extractWeekFromBatch(batch: string) {
    const match = batch?.match(/Week(\d+)/i)
    return match ? `Week${match[1]}` : batch
  }

  // Filter data
  const filteredAds = ads.filter(ad => {
    if (filters.batch !== 'All' && ad.batch !== filters.batch) return false
    if (filters.week !== 'All') {
      const adWeek = extractWeekFromBatch(ad.batch)
      if (adWeek !== filters.week) return false
    }
    if (filters.persona !== 'All' && ad.persona !== filters.persona) return false
    if (filters.conceptCode !== 'All' && ad.concept_code !== filters.conceptCode) return false
    if (filters.performanceCategory !== 'All' && ad.performance_category !== filters.performanceCategory) return false
    if (filters.status !== 'All' && ad.status !== filters.status) return false
    return true
  })

  // Sort filtered data
  const sortedAds = [...filteredAds].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    
    const aStr = String(aVal || '')
    const bStr = String(bVal || '')
    return sortDirection === 'asc' 
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr)
  })

  // Calculate totals
  const totals = filteredAds.reduce((acc, ad) => {
    const spend = parseFloat(ad.spend_7d || 0)
    const roas = parseFloat(ad.roas_7d || 0)
    
    acc.spend += spend
    acc.revenue += roas * spend
    acc.impressions += parseInt(ad.impressions_7d || 0)
    acc.clicks += parseInt(ad.clicks_7d || 0)
    acc.conversions += parseInt(ad.conversions_7d || 0)
    return acc
  }, {
    spend: 0,
    revenue: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0
  })

  const overallRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0
  const overallCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const overallCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
  const overallCvr = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0
  const overallItp = totals.impressions > 0 ? (totals.conversions / totals.impressions) * 100 : 0
  const overallPp10k = totals.impressions > 0 ? (totals.conversions / totals.impressions) * 10000 : 0

  // Get unique values for filters
  const batches = ['All', ...new Set(ads.map(ad => ad.batch).filter(Boolean))].sort()
  const weeks = ['All', ...new Set(ads.map(ad => extractWeekFromBatch(ad.batch)).filter(Boolean))].sort()
  const personas = ['All', ...new Set(ads.map(ad => ad.persona).filter(Boolean))].sort()
  const conceptCodes = ['All', ...new Set(ads.map(ad => ad.concept_code).filter(Boolean))].sort()
  const performanceCategories = ['All', 'winning', 'contender', 'fatigued', 'not-spending', 'not-performing', 'paused', 'paused-winner', 'paused-fatigued']
  const statuses = ['All', 'ACTIVE', 'PAUSED']

  if (loading) {
    return (
      <div className={`rounded-xl p-12 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        </div>
      </div>
    )
  }

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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className={`rounded-xl p-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="grid grid-cols-6 gap-4">
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-white border border-gray-300'}`}
            >
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Batch</label>
            <select
              value={filters.batch}
              onChange={(e) => setFilters({...filters, batch: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-white border border-gray-300'}`}
            >
              {batches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Week</label>
            <select
              value={filters.week}
              onChange={(e) => setFilters({...filters, week: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-white border border-gray-300'}`}
            >
              {weeks.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Persona</label>
            <select
              value={filters.persona}
              onChange={(e) => setFilters({...filters, persona: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-white border border-gray-300'}`}
            >
              {personas.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Concept</label>
            <select
              value={filters.conceptCode}
              onChange={(e) => setFilters({...filters, conceptCode: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-white border border-gray-300'}`}
            >
              {conceptCodes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Performance</label>
            <select
              value={filters.performanceCategory}
              onChange={(e) => setFilters({...filters, performanceCategory: e.target.value})}
              className={`w-full px-3 py-2 text-sm rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-white border border-gray-300'}`}
            >
              {performanceCategories.map(c => <option key={c} value={c}>{c === 'All' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Showing {sortedAds.length} ads
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportCSV}
              className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 bg-cyan-600 text-white hover:bg-cyan-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={() => setFilters({ batch: 'All', week: 'All', persona: 'All', conceptCode: 'All', performanceCategory: 'All', status: 'All' })}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Data Table with Totals */}
      <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={isDark ? 'bg-gray-750' : 'bg-gray-50'}>
              <tr>
                <th onClick={() => handleSort('status')} className={`px-4 py-3 text-left text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Status <SortIcon field="status" />
                </th>
                <th onClick={() => handleSort('concept_code')} className={`px-4 py-3 text-left text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Concept <SortIcon field="concept_code" />
                </th>
                <th onClick={() => handleSort('persona')} className={`px-4 py-3 text-left text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Persona <SortIcon field="persona" />
                </th>
                <th onClick={() => handleSort('batch')} className={`px-4 py-3 text-left text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Batch <SortIcon field="batch" />
                </th>
                <th onClick={() => handleSort('spend_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Spend <SortIcon field="spend_7d" />
                </th>
                <th onClick={() => handleSort('roas_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  ROAS <SortIcon field="roas_7d" />
                </th>
                <th onClick={() => handleSort('ctr_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  CTR <SortIcon field="ctr_7d" />
                </th>
                <th onClick={() => handleSort('cpc')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  CPC <SortIcon field="cpc" />
                </th>
                <th onClick={() => handleSort('impressions_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Impr <SortIcon field="impressions_7d" />
                </th>
                <th onClick={() => handleSort('clicks_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Clicks <SortIcon field="clicks_7d" />
                </th>
                <th onClick={() => handleSort('conversions_7d')} className={`px-4 py-3 text-right text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Conv <SortIcon field="conversions_7d" />
                </th>
                <th onClick={() => handleSort('performance_category')} className={`px-4 py-3 text-left text-xs font-medium uppercase cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  Category <SortIcon field="performance_category" />
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {sortedAds.map((ad) => (
                <tr key={ad.ad_id} className={isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      ad.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {ad.status}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{ad.concept_code}</td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{ad.persona}</td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{ad.batch}</td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    ${parseFloat(ad.spend_7d || 0).toFixed(0)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${
                    parseFloat(ad.roas_7d) >= 2.0 ? 'text-green-600' : 
                    parseFloat(ad.roas_7d) >= 1.0 ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}>
                    {parseFloat(ad.roas_7d || 0).toFixed(2)}x
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {(parseFloat(ad.ctr_7d || 0) * 100).toFixed(2)}%
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    ${parseFloat(ad.cpc || 0).toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {parseInt(ad.impressions_7d || 0).toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {parseInt(ad.clicks_7d || 0).toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {parseInt(ad.conversions_7d || 0)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      ad.performance_category === 'winning' ? 'bg-green-100 text-green-700' :
                      ad.performance_category === 'contender' ? 'bg-blue-100 text-blue-700' :
                      ad.performance_category === 'fatigued' ? 'bg-orange-100 text-orange-700' :
                      ad.performance_category === 'not-spending' ? 'bg-red-100 text-red-700' :
                      ad.performance_category === 'paused-winner' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {ad.performance_category?.replace('-', ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Unknown'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            
            {/* TOTALS FOOTER */}
            <tfoot className={`border-t-2 ${isDark ? 'border-gray-600 bg-gray-750' : 'border-gray-300 bg-gray-100'}`}>
              <tr>
                <td className={`px-4 py-4 text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`} colSpan={4}>
                  TOTALS ({filteredAds.length} ads)
                </td>
                <td className={`px-4 py-4 text-sm text-right font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  ${totals.spend.toFixed(0)}
                </td>
                <td className={`px-4 py-4 text-sm text-right font-bold ${
                  overallRoas >= 2.0 ? 'text-green-600' : 
                  overallRoas >= 1.0 ? 'text-yellow-600' : 
                  'text-red-600'
                }`}>
                  {overallRoas.toFixed(2)}x
                </td>
                <td className={`px-4 py-4 text-sm text-right font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {overallCtr.toFixed(2)}%
                </td>
                <td className={`px-4 py-4 text-sm text-right font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  ${overallCpc.toFixed(2)}
                </td>
                <td className={`px-4 py-4 text-sm text-right font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {totals.impressions.toLocaleString()}
                </td>
                <td className={`px-4 py-4 text-sm text-right font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {totals.clicks.toLocaleString()}
                </td>
                <td className={`px-4 py-4 text-sm text-right font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {totals.conversions}
                </td>
                <td className={`px-4 py-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <div className="text-xs">CVR: {overallCvr.toFixed(2)}%</div>
                  <div className="text-xs">ITP: {overallItp.toFixed(3)}%</div>
                  <div className="text-xs">PP10K: {overallPp10k.toFixed(1)}</div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}