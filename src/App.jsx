import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AuthScreen from './components/AuthScreen'
import BarCard from './components/BarCard'
import BarPage from './pages/BarPage'
import Onboarding from './components/Onboarding'
import MatchCountdown from './components/MatchCountdown'
import { SkeletonList } from './components/SkeletonCard'
import NeighborhoodLeaderboard from './components/NeighborhoodLeaderboard'
import TrendingNow from './components/TrendingNow'
import WatchPartyGroups from './components/WatchPartyGroups'
import PushNotifications from './components/PushNotifications'
import PlayTab from './components/PlayTab'
import {
  addRsvp, removeRsvp, getUserRsvps,
  submitEvent as submitEventToDb,
  getCommunityEvents,
  subscribeToVenueCounts,
  subscribeToCheckins,
  subscribeToReactions,
  subscribeToAppStats,
  subscribeToClaimedVenues,
  incrementUserCount,
  getUserReactions,
  checkIn, checkOut,
  getUserCheckin,
} from './services/firestore'
import { BARS, TEAMS, GROUP_MATCHES, TEAM_COLORS } from './data'
import './App.css'

const PER_PAGE = 5

export default function App() {
  const { user, loading } = useAuth()
  return (
    <>
      {loading && (
        <div className="app-loading">
          <div className="app-loading-icon">⚽</div>
          <div className="app-loading-text">Kickoff NYC</div>
          <div className="app-loading-sub">Loading watch parties...</div>
        </div>
      )}
      {!loading && !user && <AuthScreen />}
      {!loading && user && (
        <Routes>
          <Route path="/" element={<MainApp />} />
          <Route path="/bar/:slug" element={<BarPage />} />
        </Routes>
      )}
    </>
  )
}

function MainApp() {
  const { user, profile, logOut, updateUserProfile } = useAuth()
  const navigate = useNavigate()

  const [showOnboarding, setShowOnboarding] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [tab, setTab] = useState('discover')
  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [dataLoading, setDataLoading] = useState(true)

  const [rsvpBars, setRsvpBars] = useState([])
  const [rsvpMatches, setRsvpMatches] = useState([])
  const [communityEvents, setCommunityEvents] = useState([])
  const [venueCounts, setVenueCounts] = useState({})
  const [checkins, setCheckins] = useState({})
  const [venueReactions, setVenueReactions] = useState({})
  const [userReactions, setUserReactions] = useState({})
  const [appStats, setAppStats] = useState({})
  const [claimedVenues, setClaimedVenues] = useState({})
  const [userCurrentCheckin, setUserCurrentCheckin] = useState(null)

  const [selectedSchedTeam, setSelectedSchedTeam] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownSearch, setDropdownSearch] = useState('')
  const [teamPrefs, setTeamPrefs] = useState([])
  const [username, setUsername] = useState('')
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [profileDropdownSearch, setProfileDropdownSearch] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [isDark, setIsDark] = useState(() => localStorage.getItem('kickoff_theme') === 'dark')

  const dropdownRef = useRef(null)
  const profileDropdownRef = useRef(null)
  const newUserTracked = useRef(false)

  useEffect(() => {
    if (user) setShowOnboarding(true)
  }, [user])

  const completeOnboarding = () => setShowOnboarding(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    localStorage.setItem('kickoff_theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const toggleTheme = () => setIsDark(d => !d)

  useEffect(() => {
    if (!user?.uid) return
    setDataLoading(true)
    Promise.all([
      loadUserData(),
      loadCommunityEvents(),
      getUserCheckin(user.uid).then(setUserCurrentCheckin),
      getUserReactions(user.uid).then(setUserReactions),
    ]).then(() => setDataLoading(false))

    if (!newUserTracked.current && profile) {
      const created = profile.createdAt?.toDate?.()
      if (created && (new Date() - created) < 30000) {
        incrementUserCount()
        newUserTracked.current = true
      }
    }

    const unsubCounts    = subscribeToVenueCounts(setVenueCounts)
    const unsubCheckins  = subscribeToCheckins(setCheckins)
    const unsubReactions = subscribeToReactions(setVenueReactions)
    const unsubStats     = subscribeToAppStats(setAppStats)
    const unsubClaimed   = subscribeToClaimedVenues(setClaimedVenues)

    return () => { unsubCounts(); unsubCheckins(); unsubReactions(); unsubStats(); unsubClaimed() }
  }, [user?.uid])

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '')
      setTeamPrefs(profile.teamPrefs || [])
    }
  }, [profile])

  const loadUserData = async () => {
    if (!user?.uid) return
    try {
      const rsvps = await getUserRsvps(user.uid)
      setRsvpBars(rsvps.filter(r => r.type === 'bar'))
      setRsvpMatches(rsvps.filter(r => r.type === 'match'))
    } catch (err) { console.error(err) }
  }

  const loadCommunityEvents = async () => {
    try {
      const events = await getCommunityEvents()
      setCommunityEvents(events)
    } catch (err) { console.error(err) }
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) setProfileDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allBars = [
    ...BARS,
    ...communityEvents.map(e => ({
      name: e.venueName, address: e.address,
      borough: 'Manhattan', neighborhood: 'Midtown',
      team: e.team || 'Open',
      tags: e.vibes || ['Big screens'],
      desc: e.desc || 'Community-submitted watch party.',
      review: `Submitted by ${e.createdByName}`,
      reviewSource: 'Community event',
      isUserEvent: true,
    }))
  ]

  const filtered = allBars.filter(b => {
    const q = search.toLowerCase()
    const matchQ = !q || b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q) || b.team.toLowerCase().includes(q)
    const matchTeam = !teamFilter || b.team === teamFilter || b.team === 'Open'
    const matchLoc = !locationFilter || b.borough === locationFilter || b.neighborhood === locationFilter
    return matchQ && matchTeam && matchLoc
  })

  const sorted = [...filtered].sort((a, b) => {
    const aClaimed = claimedVenues[a.name] ? 1 : 0
    const bClaimed = claimedVenues[b.name] ? 1 : 0
    if (bClaimed !== aClaimed) return bClaimed - aClaimed
    const aC = (checkins[a.name] || []).length
    const bC = (checkins[b.name] || []).length
    if (bC !== aC) return bC - aC
    return (venueCounts[b.name] || 0) - (venueCounts[a.name] || 0)
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE))
  const pageBars = sorted.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)
  const hasBarRsvp = (name) => rsvpBars.some(r => r.targetName === name)
  const hasMatchRsvp = (name) => rsvpMatches.some(r => r.targetName === name)

  const toggleBarRsvp = async (name) => {
    const existing = rsvpBars.find(r => r.targetName === name)
    if (existing) {
      await removeRsvp(existing.id, 'bar', name)
      setRsvpBars(prev => prev.filter(r => r.id !== existing.id))
    } else {
      const id = await addRsvp(user.uid, 'bar', name)
      setRsvpBars(prev => [...prev, { id, userId: user.uid, type: 'bar', targetName: name }])
      showToast('Added to your RSVPs!')
    }
  }

  const toggleMatchRsvp = async (name) => {
    const existing = rsvpMatches.find(r => r.targetName === name)
    if (existing) {
      await removeRsvp(existing.id, 'match', name)
      setRsvpMatches(prev => prev.filter(r => r.id !== existing.id))
    } else {
      const id = await addRsvp(user.uid, 'match', name)
      setRsvpMatches(prev => [...prev, { id, userId: user.uid, type: 'match', targetName: name }])
      showToast('Match added to your RSVPs!')
    }
  }

  const handleCheckIn = async (venueName) => {
    if (userCurrentCheckin && userCurrentCheckin.venueName !== venueName) {
      await checkOut(user.uid, userCurrentCheckin.venueName)
    }
    await checkIn(user.uid, profile?.username || user.email.split('@')[0], venueName)
    setUserCurrentCheckin({ userId: user.uid, venueName })
    showToast(`You're checked in at ${venueName}! 📍`)
  }

  const handleCheckOut = async (venueName) => {
    await checkOut(user.uid, venueName)
    setUserCurrentCheckin(null)
    showToast('Checked out.')
  }

  const handleSubmitEvent = async (e) => {
    e.preventDefault()
    const form = e.target
    const venueName = form.venueName.value.trim()
    const address = form.address.value.trim()
    if (!venueName || !address) { showToast('Please fill in venue name and address.'); return }
    const vibes = [...form.querySelectorAll('.vibe-sel')].map(v => v.dataset.vibe)
    try {
      await submitEventToDb(user.uid, profile?.username || 'Anonymous', {
        venueName, address, team: form.team.value || 'Open',
        match: form.match.value, vibes, desc: form.desc.value.trim(),
      })
      await loadCommunityEvents()
      form.reset()
      document.querySelectorAll('.vibe-sel').forEach(v => v.classList.remove('vibe-sel'))
      showToast('Watch party posted! Now live in Discover.')
      setTimeout(() => setTab('discover'), 1200)
    } catch (err) { showToast('Error posting event. Please try again.') }
  }

  const handleSaveProfile = async () => {
    setProfileSaving(true)
    try {
      await updateUserProfile({ username, teamPrefs })
      showToast(`Profile saved! Welcome, ${username}.`)
    } catch (err) { showToast('Error saving profile.') }
    setProfileSaving(false)
  }

  const selectedTeamData = TEAMS.find(t => t.name === selectedSchedTeam)
  const matches = selectedSchedTeam
    ? (GROUP_MATCHES[selectedSchedTeam] || [
        { vs: 'Group stage match 1', date: 'Jun 14–26', time: 'TBD', venue: 'Various US venues' },
        { vs: 'Group stage match 2', date: 'Jun 14–26', time: 'TBD', venue: 'TBD' },
        { vs: 'Group stage match 3', date: 'Jun 14–26', time: 'TBD', venue: 'TBD' },
      ])
    : []

  const filteredTeams = TEAMS.filter(t => t.name.toLowerCase().includes(dropdownSearch.toLowerCase()))
  const filteredProfileTeams = TEAMS.filter(t => t.name.toLowerCase().includes(profileDropdownSearch.toLowerCase()))
  const totalCheckedIn = Object.values(checkins).reduce((s, a) => s + a.length, 0)

  return (
    <div className="app-shell">

      {/* ── DESKTOP SIDEBAR ── */}
      <div className={`desktop-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon">⚽</span>
          <span className="sidebar-brand-text">Kickoff NYC</span>
        </div>
        <div className="sidebar-nav">
          {[
            { id: 'discover', icon: '🗺️', label: 'Discover' },
            { id: 'schedule', icon: '📅', label: 'Schedule' },
            { id: 'play',     icon: '⚽',  label: 'Play' },
            { id: 'host',     icon: '＋',  label: 'Host' },
            { id: 'profile',  icon: '👤',  label: 'Profile' },
          ].map(n => (
            <div
              key={n.id}
              className={`sidebar-nav-item ${tab === n.id ? 'active' : ''}`}
              onClick={() => setTab(n.id)}
            >
              <span className="s-icon">{n.icon}</span>
              <span className="s-label">{n.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SIDEBAR TOGGLE — desktop only ── */}
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>
        {sidebarOpen ? '←' : '☰'}
      </button>

      {showOnboarding && <Onboarding onComplete={completeOnboarding} />}

      <div className={`app ${!sidebarOpen ? 'sidebar-hidden' : ''} ${tab === 'play' ? 'playing' : ''}`}>

        {/* ── TOPBAR ── */}
        <div className={`topbar ${tab === 'play' ? 'topbar-play-mode' : ''}`}>
          <div className="topbar-row">
            <div className="brand-row">
              <span className="brand-icon">⚽</span>
              <div>
                <div className="app-title">Kickoff NYC</div>
                <div className="app-sub">World Cup 2026 Watch Parties</div>
              </div>
            </div>
            <div className="topbar-actions">
              <button className="theme-toggle" onClick={toggleTheme}>
                {isDark ? '☀️' : '🌙'}
              </button>
              <button className="signout-btn" onClick={logOut}>Sign out</button>
            </div>
          </div>

          {tab !== 'play' && tab === 'discover' && (
            <div style={{ marginBottom: 12 }}>
              <MatchCountdown />
            </div>
          )}

          {tab !== 'play' && (
            <div className="search-wrap">
              <span className="search-icon">⌕</span>
              <input
                type="text"
                placeholder="Search bars, neighborhoods, teams..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
              />
            </div>
          )}

          {tab !== 'play' && (
            <div className="tabs">
              {['discover', 'schedule', 'host', 'profile'].map(t => (
                <div
                  key={t}
                  className={`tab ${tab === t ? 'active' : ''}`}
                  onClick={() => setTab(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </div>
              ))}
            </div>
          )}
        </div>

        {toast && <div className="toast show">{toast}</div>}

        {/* ── DISCOVER ── */}
        {tab === 'discover' && (
          <div className="tab-content">

            <div className="discover-hero">
              <div className="discover-hero-left">
                <div className="discover-hero-title">⚽ Kickoff NYC</div>
                <div className="discover-hero-sub">World Cup 2026 Watch Parties · New York City</div>
              </div>
              <div className="discover-hero-badge">
                <span className="discover-hero-dot" />
                Live
              </div>
            </div>

            <div className="app-stats-row">
              <div className="app-stat">
                <div className="app-stat-num">{appStats.totalRsvps || 0}</div>
                <div className="app-stat-label">RSVPs</div>
              </div>
              <div className="app-stat-div" />
              <div className="app-stat">
                <div className="app-stat-num" style={{ color: totalCheckedIn > 0 ? '#e53935' : undefined }}>
                  {totalCheckedIn > 0 && <span className="live-dot" style={{ marginRight: 4 }} />}
                  {totalCheckedIn}
                </div>
                <div className="app-stat-label">here now</div>
              </div>
            </div>

            {totalCheckedIn > 0 && (
              <div className="live-summary">
                <span className="live-dot" />
                {totalCheckedIn} {totalCheckedIn === 1 ? 'person' : 'people'} checked in across NYC right now
              </div>
            )}

            <TrendingNow bars={allBars} checkins={checkins} venueCounts={venueCounts} venueReactions={venueReactions} onNavigate={navigate} />
            <NeighborhoodLeaderboard checkins={checkins} venueCounts={venueCounts} />

            <div className="filter-bar">
              <select className="filter-select" value={teamFilter} onChange={e => { setTeamFilter(e.target.value); setCurrentPage(1) }}>
                <option value="">All Teams</option>
                {TEAMS.map(t => <option key={t.name}>{t.name}</option>)}
              </select>
              <select className="filter-select" value={locationFilter} onChange={e => { setLocationFilter(e.target.value); setCurrentPage(1) }}>
                <option value="">All NYC</option>
                {['Manhattan','Brooklyn','Queens','Bronx','Chelsea','Midtown','East Village','Williamsburg','Park Slope','Astoria','Financial District'].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>

            <div className="section-head">
              <span className="section-title">All watch party venues</span>
              <span className="section-count">{sorted.length} venues</span>
            </div>

            {dataLoading ? <SkeletonList count={3} /> : (
              <>
                {pageBars.length === 0 && <div className="empty-state">No venues match — try a different filter.</div>}
                {pageBars.map(b => {
                  const tc = TEAM_COLORS[b.team] || TEAM_COLORS.Open
                  return (
                    <BarCard
                      key={b.name}
                      bar={{ ...b, teamColor: tc }}
                      rsvpCount={venueCounts[b.name] || 0}
                      checkins={checkins}
                      isGoing={hasBarRsvp(b.name)}
                      onToggleRsvp={toggleBarRsvp}
                      onCheckIn={handleCheckIn}
                      onCheckOut={handleCheckOut}
                      venueReactions={venueReactions}
                      userReactions={userReactions}
                      claimedVenues={claimedVenues}
                      onNavigate={navigate}
                    />
                  )
                })}
              </>
            )}

            {!dataLoading && (
              <div className="pagination">
                <button className="page-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>← Prev</button>
                <span className="page-info">Page {currentPage} of {totalPages}</span>
                <button className="page-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next →</button>
              </div>
            )}

            <div className="owner-cta">
              <div className="owner-cta-top">
                <div className="owner-cta-icon">🍺</div>
                <div>
                  <div className="owner-cta-title">Own or manage a bar?</div>
                  <div className="owner-cta-sub">List your World Cup watch party for free and reach thousands of fans in NYC.</div>
                </div>
              </div>
              <button className="owner-cta-btn" onClick={() => setTab('host')}>List my bar →</button>
            </div>

            <div className="host-banner">
              <div className="host-top">
                <div>
                  <div className="host-title">Know a spot or are you hosting a watch party?</div>
                  <div className="host-sub">Submit it and help the community find it</div>
                </div>
                <button className="host-btn" onClick={() => setTab('host')}>+ Add</button>
              </div>
              <div className="host-chips">
                <span className="host-chip">Free to list</span>
                <span className="host-chip">Community driven</span>
                <span className="host-chip">World Cup only</span>
              </div>
            </div>
          </div>
        )}

        {/* ── SCHEDULE ── */}
        {tab === 'schedule' && (
          <div className="tab-content sched-page">
            <div className="my-rsvps-section">
              <div className="rsvp-section-label">My RSVPs</div>
              {rsvpBars.length === 0 && rsvpMatches.length === 0 && (
                <div className="empty-hint">No RSVPs yet — mark interest in a venue or RSVP to a match below.</div>
              )}
              {rsvpBars.map(r => (
                <div key={r.id} className="rsvp-pill">
                  <div>
                    <div className="rsvp-pill-name">{r.targetName}</div>
                    <div className="rsvp-pill-sub">Venue</div>
                  </div>
                  <button className="undo-btn" onClick={async () => {
                    await removeRsvp(r.id, 'bar', r.targetName)
                    setRsvpBars(prev => prev.filter(x => x.id !== r.id))
                  }}>Undo</button>
                </div>
              ))}
              {rsvpMatches.map(r => (
                <div key={r.id} className="rsvp-pill">
                  <div>
                    <div className="rsvp-pill-name">{r.targetName}</div>
                    <div className="rsvp-pill-sub">Match</div>
                  </div>
                  <button className="undo-btn" onClick={async () => {
                    await removeRsvp(r.id, 'match', r.targetName)
                    setRsvpMatches(prev => prev.filter(x => x.id !== r.id))
                  }}>Undo</button>
                </div>
              ))}
            </div>

            <div className="divider" />
            <div className="team-selector-label">Select a team to see their schedule</div>

            <div className="custom-select-wrap" ref={dropdownRef}>
              <div className={`custom-select-btn ${dropdownOpen ? 'open' : ''}`} onClick={() => setDropdownOpen(o => !o)}>
                <span className="select-flag">{selectedTeamData ? selectedTeamData.flag : '🌍'}</span>
                <div className="select-text">
                  <div className="select-country">{selectedTeamData ? selectedTeamData.name : 'Choose a country'}</div>
                  <div className="select-sub">{selectedTeamData ? `${selectedTeamData.conf} · World Cup 2026` : 'All 48 World Cup 2026 nations'}</div>
                </div>
                <span className={`select-arrow ${dropdownOpen ? 'open' : ''}`}>▾</span>
              </div>
              {dropdownOpen && (
                <div className="dropdown-list">
                  <div className="dropdown-search">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search countries..."
                      value={dropdownSearch}
                      onChange={e => setDropdownSearch(e.target.value)}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                  <div className="dropdown-items">
                    {filteredTeams.length === 0 && <div className="dropdown-empty">No results</div>}
                    {filteredTeams.map(t => (
                      <div key={t.name} className="dropdown-item" onClick={() => {
                        setSelectedSchedTeam(t.name)
                        setDropdownOpen(false)
                        setDropdownSearch('')
                      }}>
                        <span className="di-flag">{t.flag}</span>
                        <div>
                          <div className="di-name">{t.name}</div>
                          <div className="di-conf">{t.conf}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {selectedTeamData && (
              <div>
                <div className="team-header" style={{ background: selectedTeamData.bg }}>
                  <div className="team-header-flag">{selectedTeamData.flag}</div>
                  <div className="team-header-name" style={{ color: selectedTeamData.color }}>{selectedTeamData.name}</div>
                  <div className="team-header-sub" style={{ color: selectedTeamData.color }}>
                    {selectedTeamData.conf} · {matches.length} group stage matches · World Cup 2026
                  </div>
                </div>
                {matches.map((m, i) => {
                  const key = `${selectedTeamData.name} vs ${m.vs} — ${m.date}`
                  const going = hasMatchRsvp(key)
                  return (
                    <div key={i} className="match-card">
                      <div className="match-card-top">
                        <div className="match-stage" style={{ color: selectedTeamData.color }}>Group Stage · Match {i + 1}</div>
                        <div className="match-vs">{selectedTeamData.flag} {selectedTeamData.name} vs {m.vs}</div>
                        <div className="match-detail">{m.date} · {m.time} · {m.venue}</div>
                      </div>
                      <div className="match-card-foot">
                        <button className="find-btn" onClick={() => { setTeamFilter(selectedTeamData.name); setTab('discover') }}>Find bar</button>
                        <button className={`rsvp-match-btn ${going ? 'going' : ''}`} onClick={() => toggleMatchRsvp(key)}>
                          {going ? 'Going ✓' : 'RSVP'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {!selectedTeamData && <div className="empty-hint">Pick any of the 48 qualified nations to see their match schedule.</div>}
          </div>
        )}

        {/* ── PLAY ── */}
        {tab === 'play' && <PlayTab />}

        {/* ── HOST ── */}
        {tab === 'host' && (
          <div className="tab-content">
            <div className="host-hero">
              <div className="host-hero-emoji">🏆</div>
              <div className="host-hero-title">Host a Watch Party!</div>
              <div className="host-hero-sub">You bring the energy, we bring the crowd.</div>
            </div>
            <div className="host-steps">
              {['Fill in your venue', 'Pick the match', 'Set the vibe', 'Go live!'].map((s, i) => (
                <div key={i} className="host-step">
                  <div className="host-step-num">{i + 1}</div>
                  <div className="host-step-label">{s}</div>
                </div>
              ))}
            </div>
            <form className="create-form" onSubmit={handleSubmitEvent}>
              <label className="form-label">Bar / venue name</label>
              <input className="form-input" name="venueName" placeholder="e.g. Smithfield Hall" />
              <label className="form-label">Full address</label>
              <input className="form-input" name="address" placeholder="e.g. 138 W 25th St, Chelsea, NY" />
              <label className="form-label">Supporting team</label>
              <select className="form-input" name="team">
                <option value="Open">Open to all</option>
                {TEAMS.map(t => <option key={t.name} value={t.name}>{t.flag} {t.name}</option>)}
              </select>
              <label className="form-label">Match to show</label>
              <select className="form-input" name="match">
                <option>All Group Stage matches</option>
                <option>Argentina vs France — Jun 14</option>
                <option>Brazil vs Morocco — Jun 14</option>
                <option>Colombia vs England — Jun 15</option>
                <option>USA vs Honduras — Jun 15</option>
                <option>Full tournament — all matches</option>
              </select>
              <div className="form-row">
                <div><label className="form-label">Date</label><input className="form-input" type="date" name="date" /></div>
                <div><label className="form-label">Start time</label><input className="form-input" type="time" name="time" /></div>
              </div>
              <label className="form-label">Set the vibe</label>
              <VibeSelector />
              <label className="form-label">Tell people what to expect</label>
              <textarea className="form-input" name="desc" rows={2} placeholder="e.g. Best Argentina bar in Queens — come loud, come proud!" />
              <button className="submit-btn" type="submit">⚡ Post my watch party</button>
            </form>
          </div>
        )}

        {/* ── PROFILE ── */}
        {tab === 'profile' && (
          <div className="tab-content profile-wrap">
            <div className="avatar-row">
              <div className="avatar-circle">
                {profile?.photoURL
                  ? <img src={profile.photoURL} alt="avatar" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
                  : <span>{(username || 'U').slice(0, 2).toUpperCase()}</span>
                }
              </div>
              <div style={{ flex: 1 }}>
                <input className="profile-name-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Your name" />
                <div className="profile-sub">{user.email} · Member since 2026</div>
              </div>
            </div>

            {userCurrentCheckin && (
              <div className="checkin-status">
                <span className="live-dot" style={{ display: 'inline-block', marginRight: 6 }} />
                Checked in at <strong>{userCurrentCheckin.venueName}</strong>
                <button className="checkout-link" onClick={() => handleCheckOut(userCurrentCheckin.venueName)}>Check out</button>
              </div>
            )}

            <PushNotifications />

            <div className="pref-section">
              <div className="pref-label">My team preferences</div>
              <div className="custom-select-wrap" ref={profileDropdownRef}>
                <div className={`custom-select-btn ${profileDropdownOpen ? 'open' : ''}`} onClick={() => setProfileDropdownOpen(o => !o)}>
                  <span className="select-flag">🌍</span>
                  <div className="select-text">
                    <div className="select-country">Add a team to follow</div>
                    <div className="select-sub">All 48 World Cup nations</div>
                  </div>
                  <span className={`select-arrow ${profileDropdownOpen ? 'open' : ''}`}>▾</span>
                </div>
                {profileDropdownOpen && (
                  <div className="dropdown-list">
                    <div className="dropdown-search">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search countries..."
                        value={profileDropdownSearch}
                        onChange={e => setProfileDropdownSearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                    <div className="dropdown-items">
                      {filteredProfileTeams.map(t => (
                        <div key={t.name} className="dropdown-item" onClick={() => {
                          if (!teamPrefs.includes(t.name)) setTeamPrefs(p => [...p, t.name])
                          setProfileDropdownOpen(false)
                          setProfileDropdownSearch('')
                        }}>
                          <span className="di-flag">{t.flag}</span>
                          <div>
                            <div className="di-name">{t.name}</div>
                            <div className="di-conf">{t.conf}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="pref-chips">
                {teamPrefs.map(n => {
                  const t = TEAMS.find(x => x.name === n)
                  return (
                    <span key={n} className="pref-chip">
                      {t?.flag} {n}
                      <span className="pref-chip-x" onClick={() => setTeamPrefs(p => p.filter(x => x !== n))}>×</span>
                    </span>
                  )
                })}
              </div>
            </div>

            <div className="pref-section">
              <div className="pref-label">My RSVPs</div>
              {rsvpBars.length === 0 && rsvpMatches.length === 0
                ? <div style={{ fontSize: 13, color: '#888' }}>No RSVPs yet.</div>
                : <>
                    {rsvpBars.map(r => <div key={r.id} className="profile-rsvp-item">📍 {r.targetName}</div>)}
                    {rsvpMatches.map(r => <div key={r.id} className="profile-rsvp-item">⚽ {r.targetName}</div>)}
                  </>
              }
            </div>

            <div className="pref-section">
              <div className="pref-label">Watch Party Groups</div>
              <WatchPartyGroups />
            </div>

            <button className="save-btn" onClick={handleSaveProfile} disabled={profileSaving}>
              {profileSaving ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        )}

        {/* ── BOTTOM NAV — mobile only ── */}
        <div className="bottom-nav">
          {[
            { id: 'discover', icon: '🗺️', label: 'Discover' },
            { id: 'schedule', icon: '📅', label: 'Schedule' },
            { id: 'play',     icon: '⚽',  label: 'Play' },
            { id: 'host',     icon: '＋',  label: 'Host' },
            { id: 'profile',  icon: '👤',  label: 'Profile' },
          ].map(n => (
            <div key={n.id} className={`nav-item ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
              <div className="nav-icon">{n.icon}</div>
              <div className="nav-label">{n.label}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

function VibeSelector() {
  const vibes = ['📺 Big screens', '🔥 Rowdy crowd', '👪 Family friendly', '🌿 Outdoor / patio', '✓ No cover', '🍕 Food specials', '🍺 Drink deals', '🎉 Pre-match party']
  const [selected, setSelected] = useState([])
  const toggle = (v) => setSelected(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v])
  return (
    <div className="vibe-grid">
      {vibes.map(v => (
        <span key={v} className={`vibe-tag ${selected.includes(v) ? 'sel vibe-sel' : ''}`}
          data-vibe={v} onClick={() => toggle(v)}>{v}</span>
      ))}
    </div>
  )
}
