import { useRef } from 'react'
import './PlayTab.css'

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

export default function PlayTab() {
  const iframeRef = useRef(null)

  // Desktop only — fullscreen button
  const goFullscreen = async () => {
    const wrap = iframeRef.current?.parentElement
    if (!wrap) return
    try {
      if (wrap.requestFullscreen) await wrap.requestFullscreen()
      else if (wrap.webkitRequestFullscreen) await wrap.webkitRequestFullscreen()
    } catch (e) {
      window.open('/game.html', '_blank')
    }
  }

  return (
    <div className="play-tab">
      {/* Desktop header only */}
      {!isMobile && (
        <div className="play-header">
          <div>
            <div className="play-title">⚽ El Camino</div>
            <div className="play-sub">Road to Mexico 2026 — kill time before the match</div>
          </div>
          <button className="play-fullscreen-btn" onClick={goFullscreen}>
            ⛶ Full screen
          </button>
        </div>
      )}

      <div className="play-frame-wrap">
        <iframe
          ref={iframeRef}
          src="/game.html"
          className="play-frame"
          title="El Camino"
          allowFullScreen
          allow="fullscreen"
        />

        {/* Landscape blocker — mobile only */}
        <div className="play-landscape-block">
          <div className="play-landscape-msg">
            <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f5c518', marginBottom: 8 }}>
              Keep it vertical
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              El Camino plays best in portrait mode — like a Game Boy!
            </div>
          </div>
        </div>
      </div>
       {isMobile && (
  <div className="play-homescreen-tip">
    ⚡ Add to Home Screen for true full screen
  </div>
)}
    </div>
  )
}
// deploy Sun May 17 21:37:34 EDT 2026
