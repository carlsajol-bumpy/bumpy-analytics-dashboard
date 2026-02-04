'use client'
import { useEffect, useState } from 'react'
import PasskeyLogin from './PasskeyLogin'

interface AuthWrapperProps {
  children: React.ReactNode
  isDark?: boolean
}

export default function AuthWrapper({ children, isDark = true }: AuthWrapperProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = () => {
    try {
      const authData = localStorage.getItem('bumpy_auth')
      
      if (!authData) {
        setIsAuthenticated(false)
        setIsLoading(false)
        return
      }

      const parsed = JSON.parse(authData)
      
      // Check if authentication is expired
      if (parsed.expiresAt) {
        const expiryDate = new Date(parsed.expiresAt)
        const now = new Date()
        
        if (expiryDate < now) {
          // Expired - remove auth and show login
          localStorage.removeItem('bumpy_auth')
          setIsAuthenticated(false)
          setIsLoading(false)
          return
        }
      }

      // Valid authentication
      setIsAuthenticated(true)
      setIsLoading(false)
    } catch (err) {
      console.error('Auth check error:', err)
      localStorage.removeItem('bumpy_auth')
      setIsAuthenticated(false)
      setIsLoading(false)
    }
  }

  const handleLoginSuccess = () => {
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('bumpy_auth')
    setIsAuthenticated(false)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Loading...</p>
        </div>
      </div>
    )
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return <PasskeyLogin onSuccess={handleLoginSuccess} isDark={isDark} />
  }

  // Authenticated - show dashboard with logout option
  return (
    <div>
      {/* Add logout button to top-right corner */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={handleLogout}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            isDark 
              ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700' 
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
      
      {/* Dashboard content */}
      {children}
    </div>
  )
}