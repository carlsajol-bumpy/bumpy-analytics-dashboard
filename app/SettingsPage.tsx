'use client'
import { useState } from 'react'

export default function SettingsPage({ isDark }: { isDark?: boolean }) {
  const [settings, setSettings] = useState({
    autoRefresh: true,
    refreshInterval: 60,
    notifications: true,
    slackAlerts: false,
    emailReports: true,
    currency: 'USD',
    timezone: 'UTC'
  })

  const [saved, setSaved] = useState(false)

  function handleSave() {
    console.log('Saving settings:', settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* General Settings */}
      <div className={`rounded-xl shadow-sm border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>General</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Auto-refresh data</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Automatically fetch new data</div>
            </div>
            <button
              onClick={() => setSettings({...settings, autoRefresh: !settings.autoRefresh})}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.autoRefresh ? 'bg-cyan-600' : (isDark ? 'bg-gray-600' : 'bg-gray-300')
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.autoRefresh ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              Refresh Interval (seconds)
            </label>
            <input
              type="number"
              value={settings.refreshInterval}
              onChange={(e) => setSettings({...settings, refreshInterval: parseInt(e.target.value)})}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              min="30"
              max="300"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Currency</label>
            <select
              value={settings.currency}
              onChange={(e) => setSettings({...settings, currency: e.target.value})}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="PHP">PHP - Philippine Peso</option>
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Timezone</label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({...settings, timezone: e.target.value})}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Asia/Manila">Philippine Time (PHT)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className={`rounded-xl shadow-sm border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Notifications</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Push notifications</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Get notified about important events</div>
            </div>
            <button
              onClick={() => setSettings({...settings, notifications: !settings.notifications})}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.notifications ? 'bg-cyan-600' : (isDark ? 'bg-gray-600' : 'bg-gray-300')
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.notifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Slack alerts</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Send alerts to Slack channel</div>
            </div>
            <button
              onClick={() => setSettings({...settings, slackAlerts: !settings.slackAlerts})}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.slackAlerts ? 'bg-cyan-600' : (isDark ? 'bg-gray-600' : 'bg-gray-300')
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.slackAlerts ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Email reports</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Receive weekly performance reports</div>
            </div>
            <button
              onClick={() => setSettings({...settings, emailReports: !settings.emailReports})}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.emailReports ? 'bg-cyan-600' : (isDark ? 'bg-gray-600' : 'bg-gray-300')
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.emailReports ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* API Keys */}
      <div className={`rounded-xl shadow-sm border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>API Keys</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Meta Access Token</label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="••••••••••••••••"
                className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                  isDark 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
              <button className={`px-4 py-2 rounded-lg transition-colors ${
                isDark 
                  ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}>
                Update
              </button>
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Slack Webhook URL</label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="••••••••••••••••"
                className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                  isDark 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
              <button className={`px-4 py-2 rounded-lg transition-colors ${
                isDark 
                  ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}>
                Update
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
        >
          Save Settings
        </button>
        {saved && (
          <span className="text-green-600 text-sm font-medium flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Settings saved successfully!
          </span>
        )}
      </div>
    </div>
  )
}