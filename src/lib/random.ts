import { randomInt } from 'crypto';

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickRandom<T>(items: T[], count: number): T[] {
  return shuffle(items).slice(0, Math.max(0, count));
}
