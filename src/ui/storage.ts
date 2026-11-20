/** Preferências locais do jogador. Falhas (modo privado, cookies bloqueados) são ignoradas. */
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sem armazenamento: o jogo continua funcionando, só não lembra
  }
}
