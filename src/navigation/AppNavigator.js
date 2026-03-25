import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator
} from 'react-native'
import Icon from 'react-native-vector-icons/Ionicons'
import { useAuthStore } from '../store/useAuthStore'
import { api } from '../services/api'

import { LoginScreen } from '../screens/LoginScreen'
import { RegisterScreen } from '../screens/RegisterScreen'
import { DashboardScreen } from '../screens/DashboardScreen'
import { GenerateScreen } from '../screens/GenerateScreen'
import { ProfileScreen } from '../screens/ProfileScreen'
import { DetailScreen } from '../screens/DetailScreen'
import { AdminScreen } from '../screens/AdminScreen'

// Simple web-compatible navigator (no react-navigation needed)
export function AppNavigator() {
  const { user, token, isLoading, setAuth, setLoading, clearAuth } = useAuthStore()
  const [screen, setScreen] = useState('Login')
  const [params, setParams] = useState({})

  useEffect(() => {
    if (!token) { setLoading(false); return }
    api.me().then(u => { setAuth(u, token); setScreen('Dashboard') }).catch(() => clearAuth())
  }, [])

  useEffect(() => {
    if (user && (screen === 'Login' || screen === 'Register')) setScreen('Dashboard')
    if (!user && screen !== 'Login' && screen !== 'Register') setScreen('Login')
  }, [user])

  function navigate(name, p = {}) { setScreen(name); setParams(p) }
  const nav = { navigate, goBack: () => setScreen('Dashboard') }

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={{ color: '#6B7280', marginTop: 12 }}>Loading...</Text>
      </View>
    )
  }

  // Auth screens (no chrome)
  if (!user) {
    if (screen === 'Register') return <RegisterScreen navigation={nav} />
    return <LoginScreen navigation={nav} />
  }

  // Main app with bottom tabs
  const tabs = [
    { name: 'Dashboard', icon: 'grid-outline', activeIcon: 'grid', label: 'Media' },
    { name: 'Generate', icon: 'sparkles-outline', activeIcon: 'sparkles', label: 'Generate' },
    { name: 'Profile', icon: 'person-outline', activeIcon: 'person', label: 'Profile' },
  ]

  const mainScreens = ['Dashboard', 'Generate', 'Profile']
  const activeTab = mainScreens.includes(screen) ? screen : 'Dashboard'

  function renderScreen() {
    switch (screen) {
      case 'Dashboard': return <DashboardScreen navigation={nav} />
      case 'Generate':  return <GenerateScreen navigation={nav} />
      case 'Profile':   return <ProfileScreen navigation={nav} />
      case 'Detail':    return <DetailScreen navigation={nav} route={{ params }} />
      case 'Admin':     return <AdminScreen navigation={nav} />
      default:          return <DashboardScreen navigation={nav} />
    }
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        {!mainScreens.includes(screen) && (
          <TouchableOpacity onPress={() => nav.goBack()} style={s.back}>
            <Icon name="arrow-back" size={22} color="white" />
          </TouchableOpacity>
        )}
        <Text style={s.headerTitle}>
          {screen === 'Dashboard' ? '✦ Lumina' : screen}
        </Text>
      </View>

      {/* Screen content */}
      <View style={s.content}>
        {renderScreen()}
      </View>

      {/* Bottom Tab Bar */}
      <View style={s.tabBar}>
        {tabs.map(tab => {
          const active = activeTab === tab.name
          return (
            <TouchableOpacity
              key={tab.name}
              style={s.tab}
              onPress={() => navigate(tab.name)}
            >
              <Icon
                name={active ? tab.activeIcon : tab.icon}
                size={24}
                color={active ? '#A78BFA' : '#4B5563'}
              />
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A' },
  center: { flex: 1, backgroundColor: '#0F0F1A', justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F1A',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E'
  },
  back: { marginRight: 12, padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: 'white', letterSpacing: 1 },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0F0F1A',
    borderTopWidth: 1,
    borderTopColor: '#1A1A2E',
    paddingVertical: 10,
    paddingBottom: 16
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  tabLabel: { fontSize: 11, color: '#4B5563', fontWeight: '600' },
  tabLabelActive: { color: '#A78BFA' }
})
