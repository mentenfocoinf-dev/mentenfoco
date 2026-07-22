// ============================================================================
// Gráfica de tendencia PHQ-9 / GAD-7.
//
// Extraída de PatientDashboard para poder usarla también en la ficha del
// paciente (vista del terapeuta) sin duplicar ni la serie ni el gráfico. Las
// dos vistas muestran exactamente los mismos datos; solo cambia el texto que
// las acompaña, de ahí que `emptyMessage` sea configurable.
// ============================================================================
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PsychometricEvaluation } from "../../lib/api";

interface TrendChartProps {
  evaluations: PsychometricEvaluation[];
  emptyMessage?: string;
  height?: number;
}

interface TrendPoint {
  date: string;
  ts: number;
  phq9?: number;
  gad7?: number;
}

/**
 * Agrupa las evaluaciones por día. Se guarda el timestamp real (`ts`) aparte de
 * la etiqueta: no se puede ordenar por la etiqueta d/m/aaaa porque `new Date()`
 * la interpreta como m/d/aaaa y termina invirtiendo el eje temporal.
 */
export function buildTrendSeries(evaluations: PsychometricEvaluation[]): TrendPoint[] {
  const byDate = new Map<string, TrendPoint>();
  for (const ev of evaluations) {
    if (ev.scale_type !== "phq9" && ev.scale_type !== "gad7") continue;
    const d = new Date(ev.evaluated_at);
    const dateKey = d.toLocaleDateString();
    const entry = byDate.get(dateKey) ?? { date: dateKey, ts: d.getTime() };
    entry[ev.scale_type as "phq9" | "gad7"] = ev.total_score;
    byDate.set(dateKey, entry);
  }
  return Array.from(byDate.values()).sort((a, b) => a.ts - b.ts);
}

export function TrendChart({
  evaluations,
  emptyMessage = "Aún no hay suficientes evaluaciones PHQ-9 o GAD-7 para mostrar una tendencia.",
  height = 256,
}: TrendChartProps) {
  const trendData = useMemo(() => buildTrendSeries(evaluations), [evaluations]);

  // Con un solo punto no hay línea que dibujar, solo un dato suelto.
  if (trendData.length < 2) {
    return <p className="text-sm italic text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #e2e8f0" }} />
          <Line
            type="monotone"
            dataKey="phq9"
            name="PHQ-9"
            stroke="#6366f1"
            strokeWidth={2}
            connectNulls
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="gad7"
            name="GAD-7"
            stroke="#f59e0b"
            strokeWidth={2}
            connectNulls
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
