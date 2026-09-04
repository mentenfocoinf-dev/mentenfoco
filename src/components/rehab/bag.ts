// Bolsa sin reemplazo: entrega índices 0..size-1 en orden aleatorio y no repite
// hasta agotar el conjunto; al agotarse, vuelve a barajar. Evita que una misma
// consigna salga varias veces seguidas en una partida.
export interface Bag {
  next(): number;
}

export function createBag(size: number): Bag {
  let orden: number[] = [];
  return {
    next(): number {
      if (size <= 0) return 0;
      if (orden.length === 0) {
        orden = Array.from({ length: size }, (_, i) => i);
        for (let i = orden.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [orden[i], orden[j]] = [orden[j], orden[i]];
        }
      }
      return orden.pop()!;
    },
  };
}
