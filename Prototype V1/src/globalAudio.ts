import { AudioManager } from './AudioManager';

let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  AudioManager.resumeContext();
  
  // Start menu music on initial interaction. 
  // If the game logic later calls playMusic('game'), it will override this.
  AudioManager.playMusic('menu');
  
  document.removeEventListener('click', unlockAudio);
  document.removeEventListener('keydown', unlockAudio);
}

document.addEventListener('click', unlockAudio);
document.addEventListener('keydown', unlockAudio);

document.addEventListener('click', (e: any) => {
  const target = e.target as HTMLElement;
  if (target.closest('button, a, [role="button"]')) {
    AudioManager.playSfx('menuSelect');
  }
});
