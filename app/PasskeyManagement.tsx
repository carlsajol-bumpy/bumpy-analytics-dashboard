'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface PasskeyManagementProps {
  isDark?: boolean
}

interface Passkey {
  id: string
  passkey: string
  user_name: string | null
  description: string | null
  is_active: boolean
  is_permanent: boolean
  expires_at: string | null
  created_at: string
  last_used_at: string | null
  usage_count: number
}

type DurationPreset = '1day' | '1week' | '1month' | 'custom'

export default function PasskeyManagement({ isDark = true }: PasskeyManagementProps) {
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  
  // Form state
  const [newPasskey, setNewPasskey] = useState({
    passkey: '',
    user_name: '',
    description: '',
    is_permanent: true,
    duration_preset: '1week' as DurationPreset,
    custom_days: 7
  })

  useEffect(() => {
    fetchPasskeys()
  }, [])

  async function fetchPasskeys() {
    setLoading(true)
    const { data, error } = await supabase
      .from('passkeys')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching passkeys:', error)
    } else {
      setPasskeys(data || [])
    }
    setLoading(false)
  }

  function getDaysFromPreset(preset: DurationPreset, customDays: number): number {
    switch (preset) {
      case '1day': return 1
      case '1week': return 7
      case '1month': return 30
      case 'custom': return customDays
      default: return 7
    }
  }

  async function handleAddPasskey() {
    if (!newPasskey.passkey.trim()) {
      alert('Passkey is required')
      return
    }

    const expires_at = newPasskey.is_permanent 
      ? null 
      : new Date(Date.now() + getDaysFromPreset(newPasskey.duration_preset, newPasskey.custom_days) * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await supabase
      .from('passkeys')
      .insert({
        passkey: newPasskey.passkey.trim(),
        user_name: newPasskey.user_name.trim() || null,
        description: newPasskey.description.trim() || null,
        is_permanent: newPasskey.is_permanent,
        expires_at,
        is_active: true
      })

    if (error) {
      alert('Error adding passkey: ' + error.message)
    } else {
      setShowAddForm(false)
      setNewPasskey({
        passkey: '',
        user_name: '',
        description: '',
        is_permanent: true,
        duration_preset: '1week',
        custom_days: 7
      })
      fetchPasskeys()
    }
  }

  async function togglePasskeyStatus(id: string, currentStatus: boolean) {
    const { error } = await supabase
      .from('passkeys')
      .update({ is_active: !currentStatus })
      .eq('id', id)

    if (error) {
      alert('Error updating passkey: ' + error.message)
    } else {
      fetchPasskeys()
    }
  }

  async function deletePasskey(id: string) {
    if (!confirm('Are you sure you want to delete this passkey?')) return

    const { error } = await supabase
      .from('passkeys')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Error deleting passkey: ' + error.message)
    } else {
      fetchPasskeys()
    }
  }

  function generateRandomPasskey() {
    const prefix = 'BUMPY2024'
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `${prefix}-${random}`
  }

  function isExpired(expires_at: string | null): boolean {
    if (!expires_at) return false
    return new Date(expires_at) < new Date()
  }

  function getDaysUntilExpiry(expires_at: string | null): number | null {
    if (!expires_at) return null
    const now = new Date()
    const expiry = new Date(expires_at)
    const diffTime = expiry.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (loading) {
    return (
      <div className={`rounded-xl p-12 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`rounded-xl p-6 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Passkey Management</h2>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Manage access to your dashboard
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Passkey
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className={`rounded-xl p-6 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Add New Passkey</h3>
          
          <div className="space-y-4">
            {/* Passkey Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Passkey (e.g., BUMPY2024-ALPHA)"
                value={newPasskey.passkey}
                onChange={(e) => setNewPasskey({...newPasskey, passkey: e.target.value})}
                className={`flex-1 px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
              <button
                onClick={() => setNewPasskey({...newPasskey, passkey: generateRandomPasskey()})}
                className={`px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Generate
              </button>
            </div>

            {/* User Name */}
            <input
              type="text"
              placeholder="User Name (optional)"
              value={newPasskey.user_name}
              onChange={(e) => setNewPasskey({...newPasskey, user_name: e.target.value})}
              className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />

            {/* Description */}
            <input
              type="text"
              placeholder="Description (optional)"
              value={newPasskey.description}
              onChange={(e) => setNewPasskey({...newPasskey, description: e.target.value})}
              className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />

            {/* Permanent Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="permanent"
                checked={newPasskey.is_permanent}
                onChange={(e) => setNewPasskey({...newPasskey, is_permanent: e.target.checked})}
                className="w-4 h-4"
              />
              <label htmlFor="permanent" className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                Permanent (never expires)
              </label>
            </div>

            {/* Duration Selection - Only show if not permanent */}
            {!newPasskey.is_permanent && (
              <div className="space-y-3">
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Expiration Duration
                </label>
                
                {/* Duration Preset Buttons */}
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPasskey({...newPasskey, duration_preset: '1day'})}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      newPasskey.duration_preset === '1day'
                        ? 'bg-cyan-600 text-white'
                        : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    1 Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPasskey({...newPasskey, duration_preset: '1week'})}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      newPasskey.duration_preset === '1week'
                        ? 'bg-cyan-600 text-white'
                        : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    1 Week
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPasskey({...newPasskey, duration_preset: '1month'})}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      newPasskey.duration_preset === '1month'
                        ? 'bg-cyan-600 text-white'
                        : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    1 Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPasskey({...newPasskey, duration_preset: 'custom'})}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      newPasskey.duration_preset === 'custom'
                        ? 'bg-cyan-600 text-white'
                        : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {/* Custom Days Input - Only show if custom selected */}
                {newPasskey.duration_preset === 'custom' && (
                  <div className="flex items-center gap-2">
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Expires in:</span>
                    <input
                      type="number"
                      min="1"
                      value={newPasskey.custom_days}
                      onChange={(e) => setNewPasskey({...newPasskey, custom_days: parseInt(e.target.value) || 1})}
                      className={`w-20 px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    />
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>days</span>
                  </div>
                )}

                {/* Preview */}
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Will expire on: {new Date(Date.now() + getDaysFromPreset(newPasskey.duration_preset, newPasskey.custom_days) * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAddPasskey}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              >
                Add Passkey
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className={`px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className={`rounded-xl p-4 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Passkeys</div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{passkeys.length}</div>
        </div>
        <div className={`rounded-xl p-4 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Active</div>
          <div className="text-2xl font-bold text-green-600">{passkeys.filter(p => p.is_active && !isExpired(p.expires_at)).length}</div>
        </div>
        <div className={`rounded-xl p-4 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Permanent</div>
          <div className="text-2xl font-bold text-cyan-600">{passkeys.filter(p => p.is_permanent).length}</div>
        </div>
        <div className={`rounded-xl p-4 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Expired</div>
          <div className="text-2xl font-bold text-red-600">{passkeys.filter(p => isExpired(p.expires_at)).length}</div>
        </div>
      </div>

      {/* Passkeys Table */}
      <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={isDark ? 'bg-gray-750' : 'bg-gray-50'}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Passkey</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>User</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Description</th>
                <th className={`px-4 py-3 text-center text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Type</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Expires</th>
                <th className={`px-4 py-3 text-center text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Status</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Usage</th>
                <th className={`px-4 py-3 text-center text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {passkeys.map((pk) => {
                const daysLeft = getDaysUntilExpiry(pk.expires_at)
                return (
                  <tr key={pk.id} className={isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}>
                    <td className={`px-4 py-3 text-sm font-mono ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                      {pk.passkey}
                    </td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {pk.user_name || '-'}
                    </td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {pk.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        pk.is_permanent 
                          ? 'bg-cyan-100 text-cyan-700' 
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {pk.is_permanent ? 'Permanent' : 'Temporary'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {pk.expires_at ? (
                        <div>
                          <div className={isExpired(pk.expires_at) ? 'text-red-600' : ''}>
                            {new Date(pk.expires_at).toLocaleDateString()}
                          </div>
                          {!isExpired(pk.expires_at) && daysLeft !== null && (
                            <div className={`text-xs ${daysLeft <= 3 ? 'text-yellow-600' : isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                              {daysLeft === 0 ? 'Expires today' : `${daysLeft} day${daysLeft > 1 ? 's' : ''} left`}
                            </div>
                          )}
                          {isExpired(pk.expires_at) && (
                            <div className="text-xs text-red-600">Expired</div>
                          )}
                        </div>
                      ) : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        pk.is_active && !isExpired(pk.expires_at)
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {pk.is_active && !isExpired(pk.expires_at) ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {pk.usage_count}x
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => togglePasskeyStatus(pk.id, pk.is_active)}
                          className={`px-3 py-1 text-xs rounded ${
                            pk.is_active
                              ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {pk.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => deletePasskey(pk.id)}
                          className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}