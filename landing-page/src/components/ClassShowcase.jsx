import { useMemo } from 'react'

const CLASSES = [
  {
    name: 'Speedster',
    color: 'neon-cyan',
    hex: '#00FFFF',
    symbol: '⚡',
    description: 'Fast drops & quick combos',
  },
  {
    name: 'Tank',
    color: 'neon-yellow',
    hex: '#FFD700',
    symbol: '🛡',
    description: 'Heavy blocks & high defense',
  },
  {
    name: 'Saboteur',
    color: 'neon-pink',
    hex: '#FF1493',
    symbol: '💣',
    description: 'Disrupt enemy boards',
  },
  {
    name: 'Support',
    color: 'neon-green',
    hex: '#00FF00',
    symbol: '💚',
    description: 'Buff allies & heal boards',
  },
]

// Generate a fixed Tetris-like grid pattern for each class
function generateGrid(classIndex) {
  // Predefined patterns to match the reference image style
  const patterns = [
    // Speedster - L and T shapes in cyan
    [
      [1, 0, 0, 0, 0],
      [1, 1, 0, 1, 0],
      [0, 1, 0, 1, 1],
      [0, 1, 1, 0, 1],
      [0, 0, 1, 0, 0],
    ],
    // Tank - big blocks in yellow
    [
      [0, 1, 1, 0, 0],
      [1, 1, 0, 1, 0],
      [1, 0, 0, 1, 1],
      [0, 0, 1, 1, 0],
      [0, 1, 1, 0, 1],
    ],
    // Saboteur - scattered pink
    [
      [1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1],
    ],
    // Support - structured green
    [
      [0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1],
      [0, 1, 1, 1, 0],
      [1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0],
    ],
  ]
  return patterns[classIndex] || patterns[0]
}

function TetrisGrid({ classIndex, hex }) {
  const grid = useMemo(() => generateGrid(classIndex), [classIndex])

  return (
    <div className="grid grid-cols-5 gap-1 mx-auto w-fit">
      {grid.flat().map((cell, i) => (
        <div
          key={i}
          className="w-5 h-5 sm:w-6 sm:h-6 rounded-sm transition-all duration-500"
          style={{
            backgroundColor: cell
              ? hex
              : 'rgba(255,255,255,0.03)',
            boxShadow: cell
              ? `0 0 6px ${hex}40, inset 0 1px 0 rgba(255,255,255,0.2)`
              : 'none',
            border: cell ? `1px solid ${hex}60` : '1px solid rgba(255,255,255,0.05)',
          }}
        />
      ))}
    </div>
  )
}

export default function ClassShowcase() {
  return (
    <section className="relative py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {CLASSES.map((cls, idx) => (
            <div
              key={cls.name}
              className={`group relative rounded-xl p-4 sm:p-5 bg-card-bg/80 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-card-bg border`}
              style={{
                borderColor: `${cls.hex}30`,
                boxShadow: `0 0 8px ${cls.hex}15, inset 0 0 8px ${cls.hex}05`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 0 15px ${cls.hex}30, inset 0 0 10px ${cls.hex}10`
                e.currentTarget.style.borderColor = `${cls.hex}60`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `0 0 8px ${cls.hex}15, inset 0 0 8px ${cls.hex}05`
                e.currentTarget.style.borderColor = `${cls.hex}30`
              }}
            >
              {/* Class name */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs">{cls.symbol}</span>
                <h3
                  className="font-pixel text-[9px] sm:text-[10px] tracking-wider"
                  style={{ color: cls.hex }}
                >
                  {cls.name}
                </h3>
              </div>

              {/* Tetris Grid */}
              <TetrisGrid classIndex={idx} hex={cls.hex} />

              {/* Description on hover */}
              <p className="mt-3 text-[10px] text-gray-500 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {cls.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
