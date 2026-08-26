import { cn } from "@/lib/cn";

/**
 * Dekorativno polje povezanih cvorova iza hero sekcije.
 *
 * Graf je rucno postavljen, ne nasumican: isti raspored svaki put znaci da
 * kompozicija ostaje kontrolisana i da nema razlike izmedju renderovanja.
 * Cisto ukras — `aria-hidden`, bez ijedne informacije koja nije i u tekstu.
 */

type Node = { x: number; y: number; r: number };

const NODES: Node[] = [
  { x: 80, y: 90, r: 3 },
  { x: 210, y: 180, r: 4.5 },
  { x: 150, y: 320, r: 3 },
  { x: 330, y: 70, r: 3.5 },
  { x: 420, y: 230, r: 5 },
  { x: 300, y: 360, r: 3 },
  { x: 540, y: 120, r: 3.5 },
  { x: 610, y: 300, r: 4 },
  { x: 700, y: 60, r: 3 },
  { x: 760, y: 200, r: 5 },
  { x: 880, y: 330, r: 3.5 },
  { x: 950, y: 130, r: 4 },
  { x: 1080, y: 240, r: 3 },
  { x: 1140, y: 80, r: 3.5 },
  { x: 1010, y: 380, r: 3 },
  { x: 460, y: 400, r: 3.5 },
];

// Indeksi u NODES. Povezani su samo bliski cvorovi — graf tako izgleda kao
// mreza, a ne kao zvezda.
const EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [1, 3],
  [1, 4],
  [3, 4],
  [4, 6],
  [4, 5],
  [5, 15],
  [4, 15],
  [6, 7],
  [6, 9],
  [7, 9],
  [8, 9],
  [9, 11],
  [9, 10],
  [10, 14],
  [11, 12],
  [11, 13],
  [12, 13],
  [10, 12],
  [7, 10],
];

// Svaka treca veza dobija "protok" — dovoljno da se primeti kretanje,
// a da ekran ne treperi.
const FLOW_EVERY = 3;

type NetworkFieldProps = {
  className?: string;
};

export function NetworkField({ className }: NetworkFieldProps) {
  return (
    <svg
      viewBox="0 0 1200 440"
      preserveAspectRatio="xMidYMid slice"
      className={cn("h-full w-full", className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="mreza-edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-mreza-400)" />
          <stop offset="100%" stopColor="var(--color-node-400)" />
        </linearGradient>
        <radialGradient id="mreza-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-mreza-400)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-mreza-400)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Difuzno svetlo iza gustog dela grafa. */}
      <circle cx="760" cy="200" r="260" fill="url(#mreza-glow)" />
      <circle cx="300" cy="240" r="200" fill="url(#mreza-glow)" />

      <g stroke="url(#mreza-edge)" strokeWidth="1.25">
        {EDGES.map(([from, to], i) => {
          const a = NODES[from];
          const b = NODES[to];
          if (!a || !b) return null;
          return (
            <line
              key={`${from}-${to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              opacity={0.45}
              className={i % FLOW_EVERY === 0 ? "mreza-link-flow" : undefined}
              style={
                i % FLOW_EVERY === 0
                  ? { animationDelay: `${(i % 7) * 0.4}s` }
                  : undefined
              }
            />
          );
        })}
      </g>

      <g fill="var(--color-mreza-300)">
        {NODES.map((n, i) => (
          <circle
            key={`${n.x}-${n.y}`}
            cx={n.x}
            cy={n.y}
            r={n.r}
            className="mreza-node-pulse"
            style={
              {
                "--node-r": `${n.r}px`,
                animationDelay: `${(i % 8) * 0.5}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </g>
    </svg>
  );
}
