import { AudioManager } from './AudioManager';

let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  AudioManager.resumeContext();
  
  // Start menu music on initial interaction only if no track (e.g. 'game') was already queued.
  if (!AudioManager.currentTrack) {
    AudioManager.playMusic('menu');
  }
  
  document.removeEventListener('click', unlockAudio, true);
  document.removeEventListener('keydown', unlockAudio, true);
}

document.addEventListener('click', unlockAudio, true);
document.addEventListener('keydown', unlockAudio, true);

document.addEventListener('click', (e: any) => {
  const target = e.target as HTMLElement;
  if (target.closest('button, a, [role="button"]')) {
    AudioManager.playSfx('menuSelect');
  }
});
