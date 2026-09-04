// Contrato común de los minijuegos de rehabilitación cognitiva.
export interface GameResult {
  score: number;
  accuracy: number; // 0..1
  durationSeconds: number;
  completed: boolean;
}

export interface GameProps {
  /** Parámetros del nivel elegido (de config.levels[difficulty]). */
  level: Record<string, number>;
  onFinish: (result: GameResult) => void;
}
