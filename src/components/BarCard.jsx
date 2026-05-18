import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  addComment, deleteComment, subscribeToComments,
  toggleReaction,
} from '../services/firestore'
import ClaimBarModal from './ClaimBarModal'
import { nameToSlug } from '../pages/BarPage'
import './BarCard.css'

const REACTIONS = [
  { emoji: '🔥', label: 'Hype' },
  { emoji: '📺', label: 'Screens' },
  { emoji: '🍺', label: 'Drinks' },
  { emoji: '🎉', label: 'Atmosphere' },
  { emoji: '🍕', label: 'Food' },
]

const SITE_URL = 'https://worldcup-watch-t1s8.vercel.app'

// Team gradient and flag mapping
const TEAM_GRADIENTS = {
  'Argentina':  { gradient: 'linear-gradient(135deg, #74b9e8 0%, #4a90d9 50%, #2563a8 100%)', flag: '🇦🇷' },
  'Brazil':     { gradient: 'linear-gradient(135deg, #f9e04b 0%, #3ab54a 50%, #1a8a2a 100%)', flag: '🇧🇷' },
  'England':    { gradient: 'linear-gradient(135deg, #cf2b2b 0%, #b01c1c 50%, #8a1212 100%)', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  'France':     { gradient: 'linear-gradient(135deg, #002395 0%, #1a3a9a 50%, #c8102e 100%)', flag: '🇫🇷' },
  'Germany':    { gradient: 'linear-gradient(135deg, #1a1a1a 0%, #444 50%, #e8b800 100%)', flag: '🇩🇪' },
  'Spain':      { gradient: 'linear-gradient(135deg, #c60b1e 0%, #aa0a19 50%, #f1bf00 100%)', flag: '🇪🇸' },
  'Portugal':   { gradient: 'linear-gradient(135deg, #006600 0%, #005500 50%, #cc0000 100%)', flag: '🇵🇹' },
  'Italy':      { gradient: 'linear-gradient(135deg, #0066cc 0%, #0055aa 50%, #006633 100%)', flag: '🇮🇹' },
  'Netherlands':{ gradient: 'linear-gradient(135deg, #ff6600 0%, #e55a00 50%, #cc4400 100%)', flag: '🇳🇱' },
  'USA':        { gradient: 'linear-gradient(135deg, #002868 0%, #1a3a7a 50%, #bf0a30 100%)', flag: '🇺🇸' },
  'Mexico':     { gradient: 'linear-gradient(135deg, #006847 0%, #005538 50%, #ce1126 100%)', flag: '🇲🇽' },
  'Colombia':   { gradient: 'linear-gradient(135deg, #fcd116 0%, #e8bc00 50%, #003087 100%)', flag: '🇨🇴' },
  'Morocco':    { gradient: 'linear-gradient(135deg, #c1272d 0%, #aa1f24 50%, #006233 100%)', flag: '🇲🇦' },
  'Japan':      { gradient: 'linear-gradient(135deg, #bc002d 0%, #a00025 50%, #ffffff 100%)', flag: '🇯🇵' },
  'South Korea':{ gradient: 'linear-gradient(135deg, #003478 0%, #002a60 50%, #cd2e3a 100%)', flag: '🇰🇷' },
  'Australia':  { gradient: 'linear-gradient(135deg, #00008b 0%, #000070 50%, #ffcc00 100%)', flag: '🇦🇺' },
  'Canada':     { gradient: 'linear-gradient(135deg, #d52b1e 0%, #c02018 50%, #ffffff 100%)', flag: '🇨🇦' },
  'Ecuador':    { gradient: 'linear-gradient(135deg, #ffd100 0%, #e8bc00 50%, #003087 100%)', flag: '🇪🇨' },
  'Senegal':    { gradient: 'linear-gradient(135deg, #00853f 0%, #006830 50%, #fdef42 100%)', flag: '🇸🇳' },
  'Open':       { gradient: 'linear-gradient(135deg, #1a3d1a 0%, #2d5a2d 60%, #3d7a3d 100%)', flag: '⚽' },
}

const getTeamStyle = (team) => TEAM_GRADIENTS[team] || TEAM_GRADIENTS['Open']

// Confetti burst component
function ConfettiBurst({ active }) {
  if (!active) return null
  const colors = ['#c8a415', '#1a3d1a', '#e53935', '#fff', '#2563a8', '#ff6600']
  const pieces = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${20 + Math.random() * 60}%`,
    top: `${30 + Math.random() * 40}%`,
    delay: `${Math.random() * 0.15}s`,
    size: `${4 + Math.random() * 4}px`,
  }))

  return (
    <div className="bc-confetti-wrap">
      {pieces.map(p => (
        <div
          key={p.id}
          className="bc-confetti-piece"
          style={{
            background: p.color,
            left: p.left,
            top: p.top,
            animationDelay: p.delay,
            width: p.size,
            height: p.size,
          }}
        />
      ))}
    </div>
  )
}

export default function BarCard({
  bar, rsvpCount, checkins, isGoing,
  onToggleRsvp, onCheckIn, onCheckOut,
  venueReactions, userReactions,
  claimedVenues, onNavigate,
}) {
  const { user, profile } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const [reacting, setReacting] = useState(false)
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  // Animation states
  const [rsvpBouncing, setRsvpBouncing] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [checkinPulsing, setCheckinPulsing] = useState(false)
  const [poppingReaction, setPoppingReaction] = useState(null)

  const checkinsHere = checkins[bar.name] || []
  const userCheckedInHere = checkinsHere.some(c => c.userId === user?.uid)
  const myReactions = userReactions[bar.name] || []
  const barReactions = venueReactions[bar.name] || {}
  const isClaimed = claimedVenues && !!claimedVenues[bar.name]
  const isVerified = !bar.isUserEvent
  const barSlug = nameToSlug(bar.name)
  const barUrl = `${SITE_URL}/bar/${barSlug}`
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bar.address)}`
  const teamStyle = getTeamStyle(bar.team)

  useEffect(() => {
    if (!expanded) return
    const unsub = subscribeToComments(bar.name, setComments)
    return unsub
  }, [expanded, bar.name])

  const handleComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim()) return
    setPosting(true)
    try {
      await addComment(user.uid, profile?.username || user.email.split('@')[0], bar.name, commentText.trim())
      setCommentText('')
    } catch (err) { console.error(err) }
    setPosting(false)
  }

  const handleReaction = async (emoji) => {
    if (reacting) return
    setReacting(true)
    setPoppingReaction(emoji)
    setTimeout(() => setPoppingReaction(null), 400)
    try { await toggleReaction(user.uid, bar.name, emoji) }
    catch (err) { console.error(err) }
    setReacting(false)
  }

  const handleRsvp = () => {
    // Bounce animation always
    setRsvpBouncing(true)
    setTimeout(() => setRsvpBouncing(false), 500)
    // Confetti only when marking interested (not removing)
    if (!isGoing) {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 800)
    }
    onToggleRsvp(bar.name)
  }

  const handleCheckIn = () => {
    if (!userCheckedInHere) {
      setCheckinPulsing(true)
      setTimeout(() => setCheckinPulsing(false), 500)
    }
    userCheckedInHere ? onCheckOut(bar.name) : onCheckIn(bar.name)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `Watch the World Cup at ${bar.name}`, url: barUrl }) }
      catch (err) {}
    } else {
      navigator.clipboard.writeText(barUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2500)
    }
  }

  const tc = bar.teamColor || { bg: '#f3e5f5', color: '#4a148c' }

  return (
    <>
      <div
        className={`bar-card ${expanded ? 'expanded' : ''}`}
        style={{
          '--card-gradient': teamStyle.gradient,
          '--card-flag': `"${teamStyle.flag}"`,
        }}
      >
        {/* ── GRADIENT PHOTO HEADER ── */}
        <div className="bc-photo-header" onClick={() => setExpanded(e => !e)}>
          {bar.isUserEvent ? (
            <div className="bc-community-badge">👥 Community event</div>
          ) : isClaimed ? (
            <div className="bc-owner-verified-badge">🏆 Owner verified</div>
          ) : (
            <div className="bc-verified-badge">✓ Verified World Cup venue</div>
          )}
        </div>

        {/* ── TOP INFO ── */}
        <div className="bc-top" onClick={() => setExpanded(e => !e)}>
          <div className="bc-info">
            <div className="bc-name-row">
              <div className="bc-name">{bar.name}</div>
            </div>
            <div className="bc-address">{bar.address}</div>
          </div>
          <div className="bc-right">
            <span className="bc-team-badge" style={{ background: tc.bg, color: tc.color }}>
              {bar.team === 'Open' ? 'All fans' : bar.team}
            </span>
            <span className="bc-expand-hint">{expanded ? 'close ▲' : 'details ▼'}</span>
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="bc-stats">
          <div className="bc-stat">
            <span className="bc-stat-num">{rsvpCount || 0}</span>
            <span className="bc-stat-label">interested</span>
          </div>
          <div className="bc-stat-divider" />
          <div className="bc-stat">
            <span className={`bc-stat-num ${checkinsHere.length > 0 ? 'live' : ''}`}>
              {checkinsHere.length > 0 && <span className="live-dot" />}
              {checkinsHere.length}
            </span>
            <span className="bc-stat-label">here now</span>
          </div>
          <div className="bc-stat-divider" />
          <div className="bc-stat">
            <span className="bc-stat-num">{comments.length > 0 ? comments.length : '—'}</span>
            <span className="bc-stat-label">comments</span>
          </div>
        </div>

        {/* ── REACTIONS ── */}
        <div className="bc-reactions">
          {REACTIONS.map(r => {
            const count = barReactions[r.emoji] || 0
            const active = myReactions.includes(r.emoji)
            const isPopping = poppingReaction === r.emoji
            return (
              <button
                key={r.emoji}
                className={`bc-reaction ${active ? 'active' : ''} ${isPopping ? 'popping' : ''}`}
                onClick={() => handleReaction(r.emoji)}
              >
                {r.emoji} {count > 0 && <span className="bc-reaction-count">{count}</span>}
              </button>
            )
          })}
        </div>

        {/* ── TAGS ── */}
        <div className="bc-tags">
          {bar.tags.map(t => <span key={t} className="bc-tag">{t}</span>)}
        </div>

        {/* ── EXPANDED ── */}
        {expanded && (
          <div className="bc-expanded-content">
            <div className="bc-desc">{bar.desc}</div>
            <div className="bc-review">
              <div className="bc-review-quote">"{bar.review}"</div>
              <div className="bc-review-source">— {bar.reviewSource}</div>
            </div>

            {isClaimed && (
              <div className="bc-owner-info">
                <span>🏆</span>
                <div>
                  <div className="bc-owner-info-title">Managed by {claimedVenues[bar.name]?.ownerName}</div>
                  <div className="bc-owner-info-sub">Verified and managed by the bar owner</div>
                </div>
              </div>
            )}

            {isVerified && !isClaimed && (
              <button className="bc-claim-btn" onClick={() => setShowClaimModal(true)}>
                🏷️ Is this your bar? Claim this listing →
              </button>
            )}

            {!bar.isUserEvent && (
              <button className="bc-fullpage-btn" onClick={() => onNavigate(`/bar/${barSlug}`)}>
                View full bar page →
              </button>
            )}

            {checkinsHere.length > 0 && (
              <div className="bc-here-now">
                <div className="bc-here-title"><span className="live-dot" /> Here right now</div>
                <div className="bc-here-names">
                  {checkinsHere.slice(0, 6).map((c, i) => (
                    <span key={i} className="bc-here-avatar">{(c.username || '?').slice(0, 2).toUpperCase()}</span>
                  ))}
                  {checkinsHere.length > 6 && <span className="bc-here-more">+{checkinsHere.length - 6} more</span>}
                </div>
              </div>
            )}

            <div className="bc-comments-section">
              <div className="bc-comments-title">💬 What people are saying</div>
              {comments.length === 0 && <div className="bc-no-comments">No comments yet — be the first!</div>}
              {comments.map(c => (
                <div key={c.id} className="bc-comment">
                  <div className="bc-comment-avatar">{(c.username || '?').slice(0, 2).toUpperCase()}</div>
                  <div className="bc-comment-body">
                    <div className="bc-comment-header">
                      <span className="bc-comment-name">{c.username}</span>
                      <span className="bc-comment-time">{c.createdAt?.toDate ? timeAgo(c.createdAt.toDate()) : 'just now'}</span>
                      {c.userId === user?.uid && <button className="bc-comment-delete" onClick={() => deleteComment(c.id)}>×</button>}
                    </div>
                    <div className="bc-comment-text">{c.text}</div>
                  </div>
                </div>
              ))}
              <form className="bc-comment-form" onSubmit={handleComment}>
                <input className="bc-comment-input" type="text" placeholder="Share the vibe, crowd size, tips..."
                  value={commentText} onChange={e => setCommentText(e.target.value)} maxLength={200} />
                <button className="bc-comment-submit" type="submit" disabled={posting || !commentText.trim()}>
                  {posting ? '...' : 'Post'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="bc-footer" style={{ position: 'relative' }}>
          <ConfettiBurst active={showConfetti} />

          <button
            className={`bc-checkin-btn ${userCheckedInHere ? 'checked-in' : ''} ${checkinPulsing ? 'just-checked-in' : ''}`}
            onClick={handleCheckIn}
          >
            {userCheckedInHere ? '📍 Here' : '📍 Check in'}
          </button>

          <a className="bc-maps-btn" href={mapsUrl} target="_blank" rel="noopener noreferrer">
            🗺 Directions
          </a>

          <button className="bc-share-btn" onClick={handleShare}>
            {shareCopied ? '✓' : '↗ Share'}
          </button>

          <button
            className={`bc-rsvp-btn ${isGoing ? 'going' : ''} ${rsvpBouncing ? 'bouncing' : ''}`}
            onClick={handleRsvp}
          >
            {isGoing ? '✓ Going' : 'Interested'}
          </button>
        </div>
      </div>

      {showClaimModal && <ClaimBarModal venueName={bar.name} onClose={() => setShowClaimModal(false)} />}
    </>
  )
}

function timeAgo(date) {
  const s = Math.floor((new Date() - date) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
