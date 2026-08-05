const TAGS = ['PUZZLE', 'ROGUELIKE', 'SABOTAGE', 'RANDOMIZED']

const TAG_COLORS = {
  PUZZLE: 'border-neon-cyan text-neon-cyan',
  ROGUELIKE: 'border-neon-pink text-neon-pink',
  SABOTAGE: 'border-neon-yellow text-neon-yellow',
  RANDOMIZED: 'border-neon-green text-neon-green',
}

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-28 pb-12 px-4 overflow-hidden">
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-pink/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 text-center max-w-4xl mx-auto">
        {/* Mode Tags */}
        <div className="mb-8">
          <p className="text-neon-green text-[10px] sm:text-xs font-semibold tracking-[0.25em] animate-float">
            · 1V1 · 4-PLAYER FFA · 2V2 TEAMS · 40-PLAYER DEATHMATCH ·
          </p>
        </div>

        {/* Main Title */}
        <div className="mb-8">
          <h1 className="font-pixel text-4xl sm:text-5xl md:text-7xl leading-tight tracking-wider">
            <span className="block text-white mb-2" style={{ textShadow: '0 0 30px rgba(255,255,255,0.15)' }}>
              BLOCK
            </span>
            <span
              className="block text-neon-cyan"
              style={{
                textShadow:
                  '0 0 10px rgba(0,255,255,0.5), 0 0 30px rgba(0,255,255,0.3), 0 0 60px rgba(0,255,255,0.15)',
              }}
            >
              QUARTET
            </span>
          </h1>
        </div>

        {/* Pill Tags */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {TAGS.map((tag) => (
            <span
              key={tag}
              className={`px-4 py-1.5 text-[10px] font-bold tracking-widest rounded-full border bg-white/5 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/10 ${TAG_COLORS[tag]}`}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-wrap justify-center gap-4">
          <button className="group relative px-8 py-3 bg-neon-cyan text-deep-purple font-bold text-sm tracking-widest rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 cursor-pointer">
            <span className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative flex items-center gap-2">
              <span>▶</span> START
            </span>
          </button>
          <button className="group px-8 py-3 bg-transparent border-2 border-purple-500/50 text-white font-bold text-sm tracking-widest rounded-lg transition-all duration-300 hover:border-purple-400 hover:bg-purple-500/10 hover:scale-105 cursor-pointer">
            <span className="flex items-center gap-2">
              <span>▶</span> Watch Trailer
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}
