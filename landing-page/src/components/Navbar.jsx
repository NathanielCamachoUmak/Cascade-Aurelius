import { useState, useEffect } from 'react'

const NAV_ITEMS = [
  'OPENING', 'MENU', 'LOBBY', 'LOADOUT', 'GAME',
  'SPECTATOR', 'POST-GAME', 'SETTINGS', 'LEADERBOARD', 'PROFILE'
]

export default function Navbar() {
  const [activeItem, setActiveItem] = useState('LOBBY')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-5 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-nav-bg/95 backdrop-blur-md shadow-lg shadow-deep-purple/50'
          : 'bg-nav-bg/80 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex-shrink-0">
            <span className="font-pixel text-sm text-white tracking-wider">
              Block{' '}
              <span className="text-neon-pink">&lt;</span>
              <span className="text-neon-cyan">Quartet</span>
              <span className="text-neon-pink">&gt;</span>
            </span>
          </div>

          {/* Navigation Links */}
          <div className="hidden lg:flex items-center space-x-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item}
                onClick={() => setActiveItem(item)}
                className={`px-3 py-2 text-[10px] font-semibold tracking-widest transition-all duration-200 rounded-sm cursor-pointer ${
                  activeItem === item
                    ? 'text-white border-b-2 border-neon-cyan'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {/* LIVE Indicator */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-neon-pink/10 px-3 py-1.5 rounded-full border border-neon-pink/30">
              <span className="w-2 h-2 rounded-full bg-neon-pink animate-pulse-live" />
              <span className="text-neon-pink text-[10px] font-bold tracking-widest">
                LIVE
              </span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
