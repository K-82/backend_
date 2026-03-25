import React, { useEffect, useState } from 'react'
import { useAuthStore } from './store/useAuthStore'
import { api } from './services/api'
import { LoginScreen } from './screens/LoginScreen'
import { RegisterScreen } from './screens/RegisterScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { GenerateScreen } from './screens/GenerateScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { DetailScreen } from './screens/DetailScreen'
import { AdminScreen } from './screens/AdminScreen'
import { ArrowLeft } from 'lucide-react'

export default function App() {
  const { user, token, isLoading, setAuth, setLoading, clearAuth } = useAuthStore()
  const [screen, setScreen] = useState('Login')
  const [params, setParams] = useState({})

  useEffect(() => {
    if (!token) { 
      setLoading(false)
      return 
    }
    api.me()
      .then(u => { 
        setAuth(u, token)
        setScreen('Dashboard')
      })
      .catch(() => clearAuth())
  }, [])

  useEffect(() => {
    if (user && (screen === 'Login' || screen === 'Register')) {
      setScreen('Dashboard')
    }
    if (!user && screen !== 'Login' && screen !== 'Register') {
      setScreen('Login')
    }
  }, [user])

  function navigate(name, p = {}) { 
    setScreen(name)
    setParams(p) 
  }

  const nav = { 
    navigate, 
    goBack: () => setScreen('Dashboard'),
    setParams
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-bg">
        <div className="text-center">
          <div className="spinner inline-block mb-4">
            <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-dark-text-muted">Loading...</p>
        </div>
      </div>
    )
  }

  // Auth screens (no chrome)
  if (!user) {
    if (screen === 'Register') return <RegisterScreen navigation={nav} />
    return <LoginScreen navigation={nav} />
  }

  // Main app with bottom tabs
  const tabs = [
    { name: 'Dashboard', icon: 'grid', label: 'Media' },
    { name: 'Generate', icon: 'sparkles', label: 'Generate' },
    { name: 'Profile', icon: 'user', label: 'Profile' },
  ]

  const mainScreens = ['Dashboard', 'Generate', 'Profile']
  const activeTab = mainScreens.includes(screen) ? screen : 'Dashboard'

  function renderScreen() {
    switch (screen) {
      case 'Dashboard': return <DashboardScreen navigation={nav} route={{ params }} />
      case 'Generate':  return <GenerateScreen navigation={nav} />
      case 'Profile':   return <ProfileScreen navigation={nav} />
      case 'Detail':    return <DetailScreen navigation={nav} route={{ params }} />
      case 'Admin':     return <AdminScreen navigation={nav} />
      default:          return <DashboardScreen navigation={nav} route={{ params }} />
    }
  }

  return (
    <div className="flex flex-col h-screen bg-dark-bg text-white max-w-md mx-auto border-l border-r border-dark-border">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-border">
        {!mainScreens.includes(screen) && (
          <button 
            onClick={() => nav.goBack()} 
            className="relative z-10 p-1 hover:opacity-70"
          >
            <ArrowLeft size={22} />
          </button>
        )}
        <h1 className="text-lg font-bold tracking-wider">
          {screen === 'Dashboard' ? '✦ Lumina' : screen}
        </h1>
      </div>

      {/* Screen content */}
      <div className="flex-1 overflow-y-auto">
        {renderScreen()}
      </div>

      {/* Bottom Tab Bar */}
      {user && mainScreens.includes(screen) && (
        <div className="flex border-t border-dark-border bg-dark-bg">
          {tabs.map(tab => {
            const active = activeTab === tab.name
            return (
              <button
                key={tab.name}
                onClick={() => navigate(tab.name)}
                className={`flex-1 py-3 px-2 text-center text-xs font-semibold flex flex-col items-center gap-1 transition-colors ${
                  active 
                    ? 'text-primary-light' 
                    : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                <div className="w-6 h-6">
                  {/* Icon placeholder */}
                  <div className={`w-full h-full flex items-center justify-center ${active ? 'text-primary-light' : 'text-gray-600'}`}>
                    {tab.name === 'Dashboard' && '📊'}
                    {tab.name === 'Generate' && '✨'}
                    {tab.name === 'Profile' && '👤'}
                  </div>
                </div>
                {tab.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
