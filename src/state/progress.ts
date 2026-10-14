import { useCallback, useEffect, useState } from 'react';

const KEY = 'ruta-git:v2';
const OLD_KEY = 'ruta-git:v1';

interface Saved {
  completed: number[];
  /** Estrellas obtenidas en cada misión (1 a 3). */
  stars: Record<number, number>;
}

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        completed: Array.isArray(p.completed) ? p.completed.filter((n: unknown) => typeof n === 'number') : [],
        stars: p.stars && typeof p.stars === 'object' ? p.stars : {},
      };
    }
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const arr = JSON.parse(old);
      if (Array.isArray(arr)) return { completed: arr.filter((n) => typeof n === 'number'), stars: {} };
    }
  } catch {
    /* sin almacenamiento: empezamos de cero */
  }
  return { completed: [], stars: {} };
}

/** Paradas y misiones completadas, guardadas en el navegador (si se puede). */
export function useProgress() {
  const [saved, setSaved] = useState<Saved>(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      /* el progreso solo vive mientras la página está abierta */
    }
  }, [saved]);

  const complete = useCallback((id: number, stars?: number) => {
    setSaved((prev) => ({
      completed: prev.completed.includes(id) ? prev.completed : [...prev.completed, id].sort((a, b) => a - b),
      stars: stars ? { ...prev.stars, [id]: Math.max(prev.stars[id] ?? 0, stars) } : prev.stars,
    }));
  }, []);

  const reset = useCallback(() => setSaved({ completed: [], stars: {} }), []);

  return { completed: saved.completed, stars: saved.stars, complete, reset };
}
