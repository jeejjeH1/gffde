"use client";
import { ColorType, createChart, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";

export interface Line { label: string; color: string; data: Array<{ ts: number; value: number }>; step?: boolean }

export function LineChart({ lines, height = 220 }: { lines: Line[]; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const chart: IChartApi = createChart(el.current, {
      height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#7d8a99", fontSize: 11 },
      grid: { vertLines: { color: "#121820" }, horzLines: { color: "#121820" } },
      rightPriceScale: { borderColor: "#1d2630" },
      timeScale: { borderColor: "#1d2630", timeVisible: true },
      localization: { priceFormatter: (v: number) => `${v.toFixed(4)}%` },
    });
    for (const l of lines) {
      const s = chart.addLineSeries({ color: l.color, lineWidth: 2, title: l.label, priceLineVisible: false, lineType: l.step ? 1 : 0 });
      const seen = new Set<number>();
      s.setData(
        l.data.map((p) => ({ time: Math.floor(p.ts / 1000) as UTCTimestamp, value: p.value * 100 }))
          .sort((a, b) => a.time - b.time).filter((p) => (seen.has(p.time) ? false : (seen.add(p.time), true))),
      );
    }
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => el.current && chart.applyOptions({ width: el.current.clientWidth }));
    ro.observe(el.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [lines, height]);
  return <div ref={el} className="w-full" />;
}
