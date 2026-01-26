'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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

interface Alert {
  id: string
  type: 'critical' | 'warning' | 'opportunity' | 'success'
  category: 'winner' | 'contender' | 'fatigued' | 'not-spending' | 'other'
  title: string
  message: string
  action: string
  entityType: 'campaign' | 'adset' | 'ad'
  entityName: string
  campaign?: string
  country?: string
  device?: string
  metric: string
  currentValue: number
  previousValue?: number
  change?: number
  ageInDays?: number
  budgetSpendPct?: number
  timestamp: Date
}

interface AlertSystemProps {
  isDark?: boolean
}

export default function AlertSystem({ isDark }: AlertSystemProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'opportunity' | 'success'>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'winner' | 'contender' | 'fatigued' | 'not-spending'>('all')

  useEffect(() => {
    analyzeAndGenerateAlerts()
  }, [])

  // Calculate days since creation
  function calculateAge(createdDate: string | null): number {
    if (!createdDate) return 0
    const created = new Date(createdDate)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - created.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Calculate budget spend percentage
  function calculateBudgetSpendPct(actualSpend: number, budget: number): number {
    if (budget === 0) return 0
    return (actualSpend / budget) * 100
  }

  // Determine performance category based on rules
  function determineCategory(
    ageInDays: number,
    budgetSpendPct: number,
    roas7d: number,
    roasPrev: number,
    ctr7d: number,
    ctrPrev: number,
    frequency7d: number
  ): 'winner' | 'contender' | 'fatigued' | 'not-spending' {
    
    // NOT SPENDING: Never reached 80% budget
    if (budgetSpendPct < 80) {
      return 'not-spending'
    }

    // CONTENDER: Under 2 weeks AND spending 80%+ of budget
    if (ageInDays < 14 && budgetSpendPct >= 80) {
      return 'contender'
    }

    // WINNER: More than 2 weeks old AND spending well
    if (ageInDays >= 14 && budgetSpendPct >= 80) {
      
      // Check for FATIGUE indicators
      const roasDecline = roasPrev > 0 ? ((roas7d - roasPrev) / roasPrev) * 100 : 0
      const ctrDecline = ctrPrev > 0 ? ((ctr7d - ctrPrev) / ctrPrev) * 100 : 0
      const highFrequency = frequency7d > 3 // Frequency > 3 is typically high
      
      // FATIGUED: ROAS dropping OR CTR dropping while frequency is high
      if ((roasDecline < -10 || ctrDecline < -10) && highFrequency) {
        return 'fatigued'
      }
      
      return 'winner'
    }

    return 'not-spending'
  }

  async function analyzeAndGenerateAlerts() {
    setLoading(true)
    
    try {
      // Fetch campaigns
      const { data: campaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .limit(1000)

      // Fetch ad sets
      const { data: adsets, error: adsetError } = await supabase
        .from('adsets')
        .select('*')
        .limit(1000)

      // Fetch ads from creative_performance
      const { data: ads, error: adsError } = await supabase
        .from('creative_performance')
        .select('*')
        .limit(10000)

      if (campaignError || adsetError || adsError) {
        console.error('Error fetching data:', { campaignError, adsetError, adsError })
        setLoading(false)
        return
      }

      const generatedAlerts: Alert[] = []

      // ========================================
      // ANALYZE CAMPAIGNS
      // ========================================
      if (campaigns && campaigns.length > 0) {
        campaigns.forEach(campaign => {
          const ageInDays = calculateAge(campaign.created_date || campaign.created_at)
          const spend7d = parseFloat(campaign.spend_7d || 0)
          const spendPrev = parseFloat(campaign.spend_prev || 0)
          const budget = parseFloat(campaign.budget || campaign.daily_budget || 0)
          const budgetSpendPct = calculateBudgetSpendPct(spend7d, budget)
          
          const roas7d = parseFloat(campaign.roas_7d || 0)
          const roasPrev = parseFloat(campaign.roas_prev || 0)
          const ctr7d = parseFloat(campaign.ctr_7d || 0)
          const ctrPrev = parseFloat(campaign.ctr_prev || 0)
          const frequency7d = parseFloat(campaign.frequency_7d || campaign.frequency || 0)
          
          const category = determineCategory(
            ageInDays,
            budgetSpendPct,
            roas7d,
            roasPrev,
            ctr7d,
            ctrPrev,
            frequency7d
          )

          // CRITICAL: Fatigued campaigns still spending
          if (category === 'fatigued' && spend7d > 100) {
            generatedAlerts.push({
              id: `critical-campaign-fatigued-${campaign.campaign_id}`,
              type: 'critical',
              category: 'fatigued',
              title: 'FATIGUED CAMPAIGN - Action Required',
              message: `Campaign "${campaign.campaign_name}" is showing fatigue signs while still spending $${safeNumber(spend7d, 0)}`,
              action: 'PAUSE immediately or create fresh creatives. Performance declining with high frequency.',
              entityType: 'campaign',
              entityName: campaign.campaign_name,
              campaign: campaign.campaign_name,
              country: campaign.primary_country,
              device: campaign.primary_device,
              metric: 'Ad Fatigue',
              currentValue: roas7d,
              previousValue: roasPrev,
              change: roasPrev > 0 ? ((roas7d - roasPrev) / roasPrev) * 100 : 0,
              ageInDays,
              budgetSpendPct,
              timestamp: new Date()
            })
          }

          // CRITICAL: Not spending campaigns wasting budget allocation
          if (category === 'not-spending' && campaign.status === 'ACTIVE' && budget > 0) {
            generatedAlerts.push({
              id: `critical-campaign-notspending-${campaign.campaign_id}`,
              type: 'critical',
              category: 'not-spending',
              title: 'NOT SPENDING - Delete Candidate',
              message: `Campaign "${campaign.campaign_name}" only spent ${safeNumber(budgetSpendPct, 0)}% of allocated budget`,
              action: 'MARK FOR DELETION. This campaign is not delivering and wasting budget allocation.',
              entityType: 'campaign',
              entityName: campaign.campaign_name,
              campaign: campaign.campaign_name,
              country: campaign.primary_country,
              device: campaign.primary_device,
              metric: 'Budget Utilization',
              currentValue: budgetSpendPct,
              ageInDays,
              budgetSpendPct,
              timestamp: new Date()
            })
          }

          // WARNING: Contenders need monitoring
          if (category === 'contender') {
            const status = roas7d >= 2.0 ? 'performing well' : 'needs optimization'
            generatedAlerts.push({
              id: `warning-campaign-contender-${campaign.campaign_id}`,
              type: roas7d >= 2.0 ? 'opportunity' : 'warning',
              category: 'contender',
              title: `📊 CONTENDER - ${roas7d >= 2.0 ? 'Monitor Closely' : 'Optimize Now'}`,
              message: `Campaign "${campaign.campaign_name}" (${ageInDays} days old) is ${status} with ${safeNumber(roas7d, 2)}x ROAS`,
              action: roas7d >= 2.0 
                ? 'MONITOR for 7 more days. If ROAS stays >2.0x, increase budget by 50%.'
                : 'OPTIMIZE targeting/creatives. Needs improvement before becoming winner.',
              entityType: 'campaign',
              entityName: campaign.campaign_name,
              campaign: campaign.campaign_name,
              country: campaign.primary_country,
              device: campaign.primary_device,
              metric: 'ROAS',
              currentValue: roas7d,
              ageInDays,
              budgetSpendPct,
              timestamp: new Date()
            })
          }

          // OPPORTUNITY: Winners ready to scale
          if (category === 'winner' && roas7d >= 2.5) {
            generatedAlerts.push({
              id: `opportunity-campaign-winner-${campaign.campaign_id}`,
              type: 'opportunity',
              category: 'winner',
              title: 'WINNER - Ready to Scale',
              message: `Campaign "${campaign.campaign_name}" is a proven winner with ${safeNumber(roas7d, 2)}x ROAS (${ageInDays} days old)`,
              action: `INCREASE BUDGET by 50-100%. Current spend: $${safeNumber(spend7d, 0)}/day. Target: $${safeNumber(spend7d * 1.75, 0)}/day`,
              entityType: 'campaign',
              entityName: campaign.campaign_name,
              campaign: campaign.campaign_name,
              country: campaign.primary_country,
              device: campaign.primary_device,
              metric: 'ROAS',
              currentValue: roas7d,
              ageInDays,
              budgetSpendPct,
              timestamp: new Date()
            })
          }

          // SUCCESS: Top performers
          if (category === 'winner' && roas7d >= 3.0) {
            generatedAlerts.push({
              id: `success-campaign-topwinner-${campaign.campaign_id}`,
              type: 'success',
              category: 'winner',
              title: 'TOP PERFORMER',
              message: `Campaign "${campaign.campaign_name}" exceeding targets with ${safeNumber(roas7d, 2)}x ROAS`,
              action: 'DOCUMENT what\'s working. Replicate this success to other campaigns/markets.',
              entityType: 'campaign',
              entityName: campaign.campaign_name,
              campaign: campaign.campaign_name,
              country: campaign.primary_country,
              device: campaign.primary_device,
              metric: 'ROAS',
              currentValue: roas7d,
              ageInDays,
              budgetSpendPct,
              timestamp: new Date()
            })
          }
        })
      }

      // ========================================
      // ANALYZE AD SETS
      // ========================================
      if (adsets && adsets.length > 0) {
        adsets.forEach(adset => {
          const ageInDays = calculateAge(adset.created_date || adset.created_at)
          const spend7d = parseFloat(adset.spend_7d || 0)
          const budget = parseFloat(adset.budget || adset.daily_budget || 0)
          const budgetSpendPct = calculateBudgetSpendPct(spend7d, budget)
          
          const roas7d = parseFloat(adset.roas_7d || 0)
          const roasPrev = parseFloat(adset.roas_prev || 0)
          const ctr7d = parseFloat(adset.ctr_7d || 0)
          const ctrPrev = parseFloat(adset.ctr_prev || 0)
          const frequency7d = parseFloat(adset.frequency_7d || adset.frequency || 0)
          
          const category = determineCategory(
            ageInDays,
            budgetSpendPct,
            roas7d,
            roasPrev,
            ctr7d,
            ctrPrev,
            frequency7d
          )

          // CRITICAL: Fatigued ad sets
          if (category === 'fatigued' && spend7d > 50) {
            generatedAlerts.push({
              id: `critical-adset-fatigued-${adset.adset_id}`,
              type: 'critical',
              category: 'fatigued',
              title: 'FATIGUED AD SET - Urgent',
              message: `Ad Set "${adset.adset_name}" showing fatigue (Freq: ${safeNumber(frequency7d, 1)}, ROAS declining)`,
              action: 'PAUSE or refresh creatives immediately. Audience is over-exposed.',
              entityType: 'adset',
              entityName: adset.adset_name || adset.name,
              campaign: adset.campaign_name,
              country: adset.primary_country,
              device: adset.primary_device,
              metric: 'Frequency',
              currentValue: frequency7d,
              previousValue: ctrPrev,
              ageInDays,
              budgetSpendPct,
              timestamp: new Date()
            })
          }

          // CRITICAL: Not spending ad sets (deletion candidates)
          if (category === 'not-spending' && adset.status === 'ACTIVE') {
            generatedAlerts.push({
              id: `critical-adset-notspending-${adset.adset_id}`,
              type: 'critical',
              category: 'not-spending',
              title: 'NOT SPENDING - Delete Candidate',
              message: `Ad Set "${adset.adset_name}" only spent ${safeNumber(budgetSpendPct, 0)}% of budget`,
              action: 'ADD TO BULK DELETION LIST. Not delivering results.',
              entityType: 'adset',
              entityName: adset.adset_name || adset.name,
              campaign: adset.campaign_name,
              country: adset.primary_country,
              device: adset.primary_device,
              metric: 'Budget Utilization',
              currentValue: budgetSpendPct,
              ageInDays,
              budgetSpendPct,
              timestamp: new Date()
            })
          }

          // OPPORTUNITY: Winner ad sets
          if (category === 'winner' && roas7d >= 2.5) {
            generatedAlerts.push({
              id: `opportunity-adset-winner-${adset.adset_id}`,
              type: 'opportunity',
              category: 'winner',
              title: 'WINNING AD SET - Scale',
              message: `Ad Set "${adset.adset_name}" proven winner with ${safeNumber(roas7d, 2)}x ROAS`,
              action: `DUPLICATE with 50% higher budget. Current: $${safeNumber(spend7d, 0)}`,
              entityType: 'adset',
              entityName: adset.adset_name || adset.name,
              campaign: adset.campaign_name,
              country: adset.primary_country,
              device: adset.primary_device,
              metric: 'ROAS',
              currentValue: roas7d,
              ageInDays,
              budgetSpendPct,
              timestamp: new Date()
            })
          }
        })
      }

      // ========================================
      // ANALYZE INDIVIDUAL ADS
      // ========================================
      if (ads && ads.length > 0) {
        ads.forEach(ad => {
          const ageInDays = calculateAge(ad.created_date || ad.upload_date || ad.created_at)
          const spend7d = parseFloat(ad.spend_7d || 0)
          
          // For ads, we need to calculate budget relative to their ad set/campaign
          // Simplified: assume if spending > $10, it's considered "spending"
          const isSpending = spend7d > 10
          const budgetSpendPct = isSpending ? 85 : 10 // Simplified for ads
          
          const roas7d = parseFloat(ad.roas_7d || 0)
          const roasPrev = parseFloat(ad.roas_prev || 0)
          const ctr7d = parseFloat(ad.ctr_7d || 0)
          const ctrPrev = parseFloat(ad.ctr_prev || 0)
          const frequency7d = parseFloat(ad.frequency_7d || ad.frequency || 0)

          // Only analyze ACTIVE ads with significant spend
          if (ad.status !== 'ACTIVE' || spend7d < 5) return

          const category = determineCategory(
            ageInDays,
            budgetSpendPct,
            roas7d,
            roasPrev,
            ctr7d,
            ctrPrev,
            frequency7d
          )

          // CRITICAL: Fatigued individual ads
          if (category === 'fatigued' && spend7d > 20) {
            generatedAlerts.push({
              id: `critical-ad-fatigued-${ad.ad_id}`,
              type: 'critical',
              category: 'fatigued',
              title: 'FATIGUED CREATIVE',
              message: `Creative in "${ad.batch}" is fatigued (Freq: ${safeNumber(frequency7d, 1)})`,
              action: 'PAUSE this creative. Create new variant with different hook/visual.',
              entityType: 'ad',
              entityName: ad.creative_name || ad.ad_id,
              campaign: ad.batch,
              country: ad.country,
              device: ad.target_os || ad.primary_device,
              metric: 'Frequency',
              currentValue: frequency7d,
              ageInDays,
              budgetSpendPct,
              timestamp: new Date()
            })
          }

          // OPPORTUNITY: High-performing ads to expand
          if (category === 'winner' && roas7d >= 3.0 && spend7d > 50) {
            generatedAlerts.push({
              id: `opportunity-ad-winner-${ad.ad_id}`,
              type: 'success',
              category: 'winner',
              title: 'WINNING CREATIVE',
              message: `Creative "${ad.creative_name}" in "${ad.batch}" delivering ${safeNumber(roas7d, 2)}x ROAS`,
              action: 'REPLICATE this creative to other markets/audiences. Proven winner.',
              entityType: 'ad',
              entityName: ad.creative_name || ad.ad_id,
              campaign: ad.batch,
              country: ad.country,
              device: ad.target_os || ad.primary_device,
              metric: 'ROAS',
              currentValue: roas7d,
              ageInDays,
              budgetSpendPct,
              timestamp: new Date()
            })
          }
        })
      }

      // ========================================
      // SUMMARY ALERTS
      // ========================================
      
      // Count deletion candidates
      const deletionCandidates = generatedAlerts.filter(a => a.category === 'not-spending')
      if (deletionCandidates.length > 0) {
        generatedAlerts.push({
          id: 'summary-bulk-deletion',
          type: 'warning',
          category: 'not-spending',
          title: `${deletionCandidates.length} Deletion Candidates Found`,
          message: `You have ${deletionCandidates.length} campaigns/ad sets that never reached 80% budget utilization`,
          action: 'REVIEW deletion list and bulk delete non-performers to clean up account.',
          entityType: 'campaign',
          entityName: 'Multiple',
          metric: 'Bulk Action',
          currentValue: deletionCandidates.length,
          timestamp: new Date()
        })
      }

      // Count scale opportunities
      const scaleOpportunities = generatedAlerts.filter(a => 
        a.category === 'winner' && a.type === 'opportunity'
      )
      if (scaleOpportunities.length > 0) {
        generatedAlerts.push({
          id: 'summary-scale-opportunities',
          type: 'opportunity',
          category: 'winner',
          title: `${scaleOpportunities.length} Scale Opportunities`,
          message: `You have ${scaleOpportunities.length} proven winners ready to scale`,
          action: 'PRIORITIZE budget increases for these high-performers.',
          entityType: 'campaign',
          entityName: 'Multiple',
          metric: 'Bulk Action',
          currentValue: scaleOpportunities.length,
          timestamp: new Date()
        })
      }

      // Sort alerts by priority
      const priorityOrder = { critical: 0, warning: 1, opportunity: 2, success: 3 }
      generatedAlerts.sort((a, b) => {
        const typeDiff = priorityOrder[a.type] - priorityOrder[b.type]
        if (typeDiff !== 0) return typeDiff
        // Within same type, sort by value
        return (b.currentValue || 0) - (a.currentValue || 0)
      })

      setAlerts(generatedAlerts)
    } catch (err) {
      console.error('Error generating alerts:', err)
    }
    
    setLoading(false)
  }

  const filteredAlerts = alerts.filter(alert => {
    const typeMatch = filter === 'all' || alert.type === filter
    const categoryMatch = categoryFilter === 'all' || alert.category === categoryFilter
    return typeMatch && categoryMatch
  })

  const alertCounts = {
    critical: alerts.filter(a => a.type === 'critical').length,
    warning: alerts.filter(a => a.type === 'warning').length,
    opportunity: alerts.filter(a => a.type === 'opportunity').length,
    success: alerts.filter(a => a.type === 'success').length
  }

  const categoryCounts = {
    winner: alerts.filter(a => a.category === 'winner').length,
    contender: alerts.filter(a => a.category === 'contender').length,
    fatigued: alerts.filter(a => a.category === 'fatigued').length,
    'not-spending': alerts.filter(a => a.category === 'not-spending').length
  }

  if (loading) {
    return (
      <div className={`rounded-xl p-12 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          <span className={`ml-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Analyzing campaigns and generating alerts...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Alert Type Filter */}
      <div className="grid grid-cols-4 gap-4">
        <button
          onClick={() => setFilter(filter === 'critical' ? 'all' : 'critical')}
          className={`rounded-xl p-4 shadow-sm border transition-all ${
            filter === 'critical' ? 'ring-1 ring-rose-500/50' : ''
          } ${isDark ? 'bg-rose-950/30 border-rose-900/50 hover:bg-rose-950/40' : 'bg-rose-50/50 border-rose-200/50 hover:bg-rose-50'}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100/80 rounded-lg">
              <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-left">
              <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Critical</div>
              <div className="text-2xl font-bold text-rose-600">{alertCounts.critical}</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter(filter === 'warning' ? 'all' : 'warning')}
          className={`rounded-xl p-4 shadow-sm border transition-all ${
            filter === 'warning' ? 'ring-1 ring-amber-500/50' : ''
          } ${isDark ? 'bg-amber-950/30 border-amber-900/50 hover:bg-amber-950/40' : 'bg-amber-50/50 border-amber-200/50 hover:bg-amber-50'}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100/80 rounded-lg">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-left">
              <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Warning</div>
              <div className="text-2xl font-bold text-amber-600">{alertCounts.warning}</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter(filter === 'opportunity' ? 'all' : 'opportunity')}
          className={`rounded-xl p-4 shadow-sm border transition-all ${
            filter === 'opportunity' ? 'ring-1 ring-blue-500/50' : ''
          } ${isDark ? 'bg-blue-950/30 border-blue-900/50 hover:bg-blue-950/40' : 'bg-blue-50/50 border-blue-200/50 hover:bg-blue-50'}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100/80 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="text-left">
              <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Opportunities</div>
              <div className="text-2xl font-bold text-blue-600">{alertCounts.opportunity}</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter(filter === 'success' ? 'all' : 'success')}
          className={`rounded-xl p-4 shadow-sm border transition-all ${
            filter === 'success' ? 'ring-1 ring-emerald-500/50' : ''
          } ${isDark ? 'bg-emerald-950/30 border-emerald-900/50 hover:bg-emerald-950/40' : 'bg-emerald-50/50 border-emerald-200/50 hover:bg-emerald-50'}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100/80 rounded-lg">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-left">
              <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Success</div>
              <div className="text-2xl font-bold text-emerald-600">{alertCounts.success}</div>
            </div>
          </div>
        </button>
      </div>

      {/* Category Filter */}
      <div className={`rounded-xl p-4 shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Filter by Performance Category:
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              categoryFilter === 'all'
                ? isDark ? 'bg-cyan-900/40 text-cyan-300 ring-1 ring-cyan-600' : 'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-400'
                : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-650' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({alerts.length})
          </button>
          <button
            onClick={() => setCategoryFilter('winner')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              categoryFilter === 'winner'
                ? isDark ? 'bg-emerald-900/40 text-emerald-300 ring-1 ring-emerald-600' : 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400'
                : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-650' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            Winners ({categoryCounts.winner})
          </button>
          <button
            onClick={() => setCategoryFilter('contender')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              categoryFilter === 'contender'
                ? isDark ? 'bg-blue-900/40 text-blue-300 ring-1 ring-blue-600' : 'bg-blue-100/80 text-blue-700 ring-1 ring-blue-400'
                : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-650' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Contenders ({categoryCounts.contender})
          </button>
          <button
            onClick={() => setCategoryFilter('fatigued')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              categoryFilter === 'fatigued'
                ? isDark ? 'bg-amber-900/40 text-amber-300 ring-1 ring-amber-600' : 'bg-amber-100 text-amber-700 ring-1 ring-amber-400'
                : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-650' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
            Fatigued ({categoryCounts.fatigued})
          </button>
          <button
            onClick={() => setCategoryFilter('not-spending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              categoryFilter === 'not-spending'
                ? isDark ? 'bg-rose-900/40 text-rose-300 ring-1 ring-rose-600' : 'bg-rose-100 text-rose-700 ring-1 ring-rose-400'
                : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-650' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Not Spending ({categoryCounts['not-spending']})
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className={`rounded-xl p-12 text-center ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            
            <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              No alerts in this category
            </h3>
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              Try selecting a different filter to see other alerts.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const styles = {
              critical: {
                border: isDark ? 'border-rose-900/50' : 'border-rose-200/50',
                bg: isDark ? 'bg-rose-950/30' : 'bg-rose-50/50',
                icon: isDark ? 'text-rose-400' : 'text-rose-600',
                iconBg: isDark ? 'bg-rose-900/30' : 'bg-rose-100/80'
              },
              warning: {
                border: isDark ? 'border-amber-900/50' : 'border-amber-200/50',
                bg: isDark ? 'bg-amber-950/30' : 'bg-amber-50/50',
                icon: isDark ? 'text-amber-400' : 'text-amber-600',
                iconBg: isDark ? 'bg-amber-900/30' : 'bg-amber-100/80'
              },
              opportunity: {
                border: isDark ? 'border-blue-900/50' : 'border-blue-200/50',
                bg: isDark ? 'bg-blue-950/30' : 'bg-blue-50/50',
                icon: isDark ? 'text-blue-400' : 'text-blue-600',
                iconBg: isDark ? 'bg-blue-900/30' : 'bg-blue-100/80'
              },
              success: {
                border: isDark ? 'border-emerald-900/50' : 'border-emerald-200/50',
                bg: isDark ? 'bg-emerald-950/30' : 'bg-emerald-50/50',
                icon: isDark ? 'text-emerald-400' : 'text-emerald-600',
                iconBg: isDark ? 'bg-emerald-900/30' : 'bg-emerald-100/80'
              }
            }

            const style = styles[alert.type]

            // Category badge color
            const categoryColors = {
              'winner': isDark ? 'bg-emerald-900/30 text-emerald-300' : 'bg-emerald-100/80 text-emerald-700',
              'contender': isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100/80 text-blue-700',
              'fatigued': isDark ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-100/80 text-amber-700',
              'not-spending': isDark ? 'bg-rose-900/30 text-rose-300' : 'bg-rose-100/80 text-rose-700',
              'other': isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
            }

            return (
              <div 
                key={alert.id}
                className={`rounded-xl p-6 border ${style.border} ${style.bg}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${style.iconBg} flex-shrink-0`}>
                    {alert.type === 'critical' && (
                      <svg className={`w-6 h-6 ${style.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    {alert.type === 'warning' && (
                      <svg className={`w-6 h-6 ${style.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {alert.type === 'opportunity' && (
                      <svg className={`w-6 h-6 ${style.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    )}
                    {alert.type === 'success' && (
                      <svg className={`w-6 h-6 ${style.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
                      <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {alert.title}
                      </h4>
                      <div className="flex gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${categoryColors[alert.category]} font-medium uppercase`}>
                          {alert.category.replace('-', ' ')}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${style.iconBg} ${style.icon} font-medium uppercase`}>
                          {alert.type}
                        </span>
                      </div>
                    </div>

                    <p className={`mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {alert.message}
                    </p>

                    {/* Meta information */}
                    <div className={`flex flex-wrap items-center gap-3 mb-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                        <span className="font-medium">{alert.entityName}</span>
                      </div>
                      {alert.campaign && (
                        <>
                          <span>•</span>
                          <span>{alert.campaign}</span>
                        </>
                      )}
                      {alert.country && (
                        <>
                          <span>•</span>
                          <span>{alert.country}</span>
                        </>
                      )}
                      {alert.device && (
                        <>
                          <span>•</span>
                          <span>{alert.device}</span>
                        </>
                      )}
                      {alert.ageInDays !== undefined && (
                        <>
                          <span>•</span>
                          <span>{alert.ageInDays} days old</span>
                        </>
                      )}
                      {alert.budgetSpendPct !== undefined && (
                        <>
                          <span>•</span>
                          <span>{safeNumber(alert.budgetSpendPct, 0)}% budget</span>
                        </>
                      )}
                    </div>

                    {/* Action recommendation */}
                    <div className={`flex items-start gap-3 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <svg className={`w-5 h-5 ${style.icon} flex-shrink-0 mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <div>
                        <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Recommended Action:
                        </div>
                        <div className={`font-semibold ${style.icon}`}>
                          {alert.action}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}