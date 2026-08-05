import Navbar from './components/Navbar'
import Hero from './components/Hero'
import ClassShowcase from './components/ClassShowcase'
import SystemsCards from './components/SystemsCards'

export default function App() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Scanline overlay */}
      <div className="fixed inset-0 pointer-events-none z-40 scanlines opacity-30" />

      {/* Page indicator */}
      <div className="fixed top-0 left-0 z-50 px-4 py-1">
        <span className="font-pixel text-[8px] text-gray-500 tracking-widest">OPENING</span>
      </div>

      <Navbar />

      <main>
        <Hero />
        <ClassShowcase />
        <SystemsCards />
      </main>

      {/* Footer accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-neon-cyan/30 to-transparent" />
      <footer className="py-6 text-center">
        <p className="text-gray-600 text-xs tracking-widest">
          © 2026 AURELIUS · BLOCK QUARTET
        </p>
      </footer>
    </div>
  )
}
