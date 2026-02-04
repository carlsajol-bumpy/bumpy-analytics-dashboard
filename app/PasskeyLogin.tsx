'use client'
import { useState } from 'react'
import Image from 'next/image'
import { supabase } from '../lib/supabase'

interface PasskeyLoginProps {
  onSuccess: () => void
  isDark?: boolean
}

export default function PasskeyLogin({ onSuccess, isDark = true }: PasskeyLoginProps) {
  const [passkey, setPasskey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Check if passkey exists and is valid
      const { data, error: fetchError } = await supabase
        .from('passkeys')
        .select('*')
        .eq('passkey', passkey.trim())
        .eq('is_active', true)
        .single()

      if (fetchError || !data) {
        setError('Invalid or inactive passkey')
        setLoading(false)
        return
      }

      // Check if passkey is expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError('This passkey has expired')
        setLoading(false)
        return
      }

      // Update usage stats
      await supabase
        .from('passkeys')
        .update({
          last_used_at: new Date().toISOString(),
          usage_count: data.usage_count + 1
        })
        .eq('id', data.id)

      // Store auth in localStorage
      const authData = {
        passkey: data.passkey,
        userName: data.user_name,
        authenticatedAt: new Date().toISOString(),
        expiresAt: data.expires_at || null
      }
      localStorage.setItem('bumpy_auth', JSON.stringify(authData))

      // Success
      onSuccess()
    } catch (err) {
      console.error('Login error:', err)
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`max-w-md w-full mx-4 ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl p-8`}>
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image 
            src="/bumpy-logo.png"
            alt="Bumpy Logo" 
            width={64} 
            height={64}
            className="rounded-xl"
          />
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Bumpy Analytics
          </h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Enter your passkey to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="passkey" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Passkey
            </label>
            <input
              type="text"
              id="passkey"
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              placeholder="Enter your passkey"
              className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
              required
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-500">{error}</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !passkey.trim()}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
              loading || !passkey.trim()
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-cyan-600 text-white hover:bg-cyan-700 active:scale-95'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Verifying...</span>
              </div>
            ) : (
              'Access Dashboard'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className={`mt-6 pt-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className={`text-xs text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Need access? Contact your administrator
          </p>
        </div>
      </div>
    </div>
  )
}