const SYSTEMS = [
  {
    title: 'Core & Sync',
    icon: 'G',
    iconColor: '#00FF00',
    items: ['FSM', 'Grid Logic', 'Delta Compression'],
    borderColor: '#00FF00',
  },
  {
    title: 'Interaction',
    icon: 'A',
    iconColor: '#FF1493',
    items: ['Class System', 'Garbage Queue', 'Targeting'],
    borderColor: '#FF1493',
  },
  {
    title: 'Progression',
    icon: '◆',
    iconColor: '#FFD700',
    items: ['Loot Blocks', '7-Bag', 'Weighted RNG'],
    borderColor: '#FFD700',
  },
  {
    title: 'Balance',
    icon: '⚖',
    iconColor: '#00FFFF',
    items: ['Combo', 'DDA', 'Scaling Elimination'],
    borderColor: '#00FFFF',
  },
]

export default function SystemsCards() {
  return (
    <section className="relative py-12 px-4 pb-20">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {SYSTEMS.map((system) => (
            <div
              key={system.title}
              className="group relative rounded-xl p-5 bg-card-bg/80 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-card-bg"
              style={{
                borderTop: `2px solid ${system.borderColor}40`,
                borderLeft: `1px solid ${system.borderColor}15`,
                borderRight: `1px solid ${system.borderColor}15`,
                borderBottom: `1px solid ${system.borderColor}15`,
                boxShadow: `0 0 8px ${system.borderColor}10`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 0 15px ${system.borderColor}25, 0 4px 20px ${system.borderColor}10`
                e.currentTarget.style.borderTopColor = `${system.borderColor}80`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `0 0 8px ${system.borderColor}10`
                e.currentTarget.style.borderTopColor = `${system.borderColor}40`
              }}
            >
              {/* Icon */}
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold mb-4"
                style={{
                  backgroundColor: `${system.iconColor}15`,
                  color: system.iconColor,
                  border: `1px solid ${system.iconColor}30`,
                }}
              >
                {system.icon}
              </div>

              {/* Title */}
              <h3 className="text-white font-bold text-sm mb-2 tracking-wide">
                {system.title}
              </h3>

              {/* Items */}
              <p className="text-gray-400 text-xs leading-relaxed">
                {system.items.join(' · ')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
