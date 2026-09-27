export type ToastTheme = 'info' | 'success' | 'warning' | 'error' | 'reward';

export function showToast(message: string, theme: ToastTheme = 'info') {
  const containerId = 'bq-toast-container';
  let container = document.getElementById(containerId);
  
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.className = 'fixed right-4 bottom-4 z-[200] flex flex-col gap-2 pointer-events-none items-end';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  
  // Base classes for the toast bubble
  let baseClasses = 'px-4 py-3 rounded-lg shadow-2xl text-sm font-bold tracking-wide animate-[float_0.3s_ease-out] border backdrop-blur-md transition-all duration-300 opacity-100 translate-y-0';
  
  // Apply theme-specific styling matching the game's neon aesthetic
  switch (theme) {
    case 'success':
      baseClasses += ' bg-card-bg/95 border-neon-green/60 text-neon-green shadow-[0_0_20px_rgba(0,255,0,0.15)]';
      break;
    case 'warning':
      baseClasses += ' bg-card-bg/95 border-neon-yellow/60 text-neon-yellow shadow-[0_0_20px_rgba(255,215,0,0.15)]';
      break;
    case 'error':
      baseClasses += ' bg-card-bg/95 border-neon-pink/60 text-neon-pink shadow-[0_0_20px_rgba(255,20,147,0.15)]';
      break;
    case 'reward':
      baseClasses += ' bg-[#151022] border-[#ffc107] text-[#ffe8a6] shadow-[0_0_30px_rgba(255,193,7,0.25)]';
      break;
    case 'info':
    default:
      baseClasses += ' bg-card-bg/95 border-neon-cyan/60 text-neon-cyan shadow-[0_0_20px_rgba(0,255,255,0.15)]';
      break;
  }

  toast.className = baseClasses;
  toast.innerHTML = message;

  container.appendChild(toast);

  // Trigger exit animation before removal
  setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300); // Wait for transition to finish
  }, 4000);
}
