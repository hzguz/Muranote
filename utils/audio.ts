export function playSound(path: string, volume: number): void {
  if (volume === 0) return;
  const audio = new Audio(path);
  audio.volume = Math.min(1, Math.max(0, volume));
  audio.play().catch(() => {});
}
