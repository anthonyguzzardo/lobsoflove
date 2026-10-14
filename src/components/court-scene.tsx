import type { ReactNode } from 'react';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

import type { Theme, ThemeId } from '@/lib/themes';

const INK = '#0b0f1a';
const SURFACE: Record<string, string> = { clay: '#c8623a', grass: '#3f9b4b', artificial_turf: '#3f9b4b' };

function Palm({ x, h = 60, y = 150 }: { x: number; h?: number; y?: number }) {
  const t = y - h;
  return (
    <G>
      <Path d={`M${x} ${y}Q${x + 5} ${y - h / 2} ${x + 2} ${t}`} stroke={INK} strokeWidth={3.5} fill="none" />
      {[-22, -12, 12, 22].map((dx) => <Path key={dx} d={`M${x + 2} ${t}q${dx / 2} ${-12} ${dx} ${6}`} stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />)}
      <Path d={`M${x + 2} ${t}q-2 -14 4 -18`} stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
    </G>
  );
}

function Waves({ y, color }: { y: number; color: string }) {
  return (
    <G>
      <Rect x={0} y={y} width={360} height={150 - y} fill={color} />
      {[0, 1, 2].map((i) => <Path key={i} d={`M0 ${y + 6 + i * 9}q15 -5 30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0`} stroke="#fffdf0" strokeOpacity={0.5 - i * 0.12} strokeWidth={1.6} fill="none" />)}
    </G>
  );
}

const Sun = ({ x, y, r, c = '#fffbd6' }: { x: number; y: number; r: number; c?: string }) => (
  <G><Circle cx={x} cy={y} r={r * 1.6} fill={c} opacity={0.22} /><Circle cx={x} cy={y} r={r} fill={c} /></G>
);

const LANDMARKS: Record<ThemeId, () => ReactNode> = {
  ucsd: () => (
    <G>
      <Ellipse cx={90} cy={62} rx={90} ry={12} fill="#fffdf0" opacity={0.35} />
      <Ellipse cx={270} cy={48} rx={110} ry={10} fill="#fffdf0" opacity={0.25} />
      {/* The library: a stepped concrete diamond on a stalk. */}
      <Polygon points="150,150 150,128 168,128 168,150" fill={INK} />
      <Polygon points="118,128 200,128 214,112 104,112" fill={INK} />
      <Polygon points="100,112 218,112 226,98 92,98" fill={INK} />
      <Polygon points="96,98 222,98 212,84 106,84" fill={INK} />
      <Polygon points="110,84 208,84 196,72 122,72" fill={INK} />
      {[92, 106, 120].map((y) => <Line key={y} x1={104} x2={214} y1={y} y2={y} stroke="#9fc7c2" strokeOpacity={0.5} strokeWidth={1.5} />)}
      {[40, 62, 286, 312, 334].map((x, i) => <G key={x}><Line x1={x} x2={x} y1={150} y2={96 - i * 3} stroke={INK} strokeWidth={3} /><Ellipse cx={x} cy={92 - i * 3} rx={11} ry={22} fill={INK} /></G>)}
    </G>
  ),
  zoo: () => (
    <G>
      <Sun x={292} y={46} r={18} />
      <Path d="M0 150V96q30-26 60-6q24-30 56-4q30-22 54 6q30-30 62-2q26-24 54 2q30-20 74 8V150Z" fill="#0c3a24" />
      {/* Giraffe looking over the fence. */}
      <Path d="M226 150V96l10-34h10l-4 12 8 4-2 8-10 2-2 62Z" fill={INK} />
      <Path d="M236 62l-2-10M244 62l2-10" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <Path d="M20 150c0-40 20-56 36-60M70 150c-4-34 8-54 26-62M318 150c4-36-8-52-22-58" stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />
    </G>
  ),
  balboa: () => (
    <G>
      <Sun x={70} y={52} r={20} />
      {/* Bell tower and dome. */}
      <Rect x={196} y={52} width={22} height={98} fill={INK} />
      <Polygon points="192,52 222,52 216,38 198,38" fill={INK} />
      <Rect x={201} y={24} width={12} height={16} fill={INK} />
      <Path d="M201 24q6-14 12 0Z" fill={INK} />
      <Line x1={207} x2={207} y1={12} y2={4} stroke={INK} strokeWidth={2} />
      <Path d="M226 150V112a30 30 0 0 1 60 0V150Z" fill={INK} />
      <Rect x={120} y={112} width={76} height={38} fill={INK} />
      {[128, 146, 164, 182].map((x) => <Path key={x} d={`M${x} 150V130a6 6 0 0 1 12 0V150Z`} fill="#ffd27a" opacity={0.7} />)}
      <Palm x={36} h={70} /><Palm x={318} h={62} />
    </G>
  ),
  downtown: () => (
    <G>
      {[[20, 70, 26], [50, 96, 22], [76, 58, 30], [110, 84, 24], [138, 40, 28], [170, 76, 26], [200, 54, 30], [234, 90, 22], [260, 66, 28], [292, 100, 24], [320, 78, 30]].map(([x, y, w]) => (
        <G key={x}><Rect x={x} y={y} width={w} height={150 - y} fill={INK} />{[0, 1, 2, 3].map((k) => <Rect key={k} x={x + 5} y={y + 8 + k * 12} width={w - 10} height={3} fill="#ffd27a" opacity={0.45} />)}</G>
      ))}
      {/* Jet on final approach. */}
      <G transform="translate(60 26) rotate(8)"><Path d="M0 6h54l10 4-10 4H0Z" fill="#fffdf0" /><Path d="M22 10l-12 16h8l16-16ZM4 6l-6-10h6l8 10Z" fill="#fffdf0" /></G>
    </G>
  ),
  coronado: () => (
    <G>
      <Sun x={300} y={44} r={16} />
      <Waves y={118} color="#2f7fd6" />
      {/* The bridge sweep. */}
      <Path d="M0 96Q150 40 360 104" stroke={INK} strokeWidth={5} fill="none" />
      {[40, 90, 140, 190, 240, 290, 334].map((x) => { const y = 96 - 46 * Math.sin((x / 360) * Math.PI) + (x / 360) * 8; return <Line key={x} x1={x} x2={x} y1={y} y2={124} stroke={INK} strokeWidth={3} />; })}
      {/* Red turret. */}
      <Rect x={150} y={112} width={70} height={38} fill="#fffdf0" />
      <Polygon points="144,112 226,112 206,88 164,88" fill="#d13a2f" />
      <Polygon points="176,88 194,88 185,62" fill="#d13a2f" />
    </G>
  ),
  ob: () => (
    <G>
      <Sun x={180} y={104} r={34} c="#fff2b0" />
      <Waves y={108} color="#d9483f" />
      {/* The pier. */}
      <Rect x={150} y={96} width={210} height={5} fill={INK} />
      {[160, 190, 220, 250, 280, 310, 340].map((x) => <Line key={x} x1={x} x2={x} y1={100} y2={134} stroke={INK} strokeWidth={3} />)}
      <Path d="M0 150V110l34-8 22 12 16 36Z" fill={INK} />
      <Palm x={30} h={64} y={112} />
    </G>
  ),
  beach: () => (
    <G>
      <Sun x={84} y={58} r={22} />
      <Waves y={112} color="#3fb6d6" />
      {/* Roller coaster on the boardwalk. */}
      <Path d="M180 150V120q26-70 52 0q20-44 40 0q18-30 36 0q16-22 52 4V150" stroke={INK} strokeWidth={4} fill="none" />
      {[196, 214, 232, 252, 272, 292, 312, 332].map((x) => <Line key={x} x1={x} x2={x} y1={150} y2={118} stroke={INK} strokeWidth={1.5} />)}
      <Palm x={40} h={58} /><Palm x={140} h={66} />
    </G>
  ),
  cove: () => (
    <G>
      <Sun x={66} y={46} r={16} />
      <Waves y={104} color="#12a3b8" />
      <Path d="M360 150V60q-30 4-44 26t-40 20q-22 2-30 22t-36 22Z" fill={INK} />
      {/* A seal on its rock. */}
      <Ellipse cx={96} cy={132} rx={46} ry={12} fill={INK} />
      <Path d="M70 126q12-18 34-8q10-12 16-4q-4 8-12 10q-8 10-38 2Z" fill="#3a3f52" />
      <Circle cx={116} cy={113} r={1.6} fill="#fffdf0" />
    </G>
  ),
  bay: () => (
    <G>
      <Sun x={292} y={42} r={16} />
      <Waves y={106} color="#3f8fe0" />
      {[[70, 1], [170, 0.75], [262, 1.15]].map(([x, s]) => (
        <G key={x} transform={`translate(${x} 110) scale(${s})`}>
          <Polygon points="0,0 0,-58 34,-6" fill="#fffdf0" />
          <Polygon points="-4,-4 -4,-44 -26,-6" fill="#fffdf0" opacity={0.85} />
          <Path d="M-30 0h68l-8 10h-52Z" fill={INK} />
        </G>
      ))}
    </G>
  ),
  northcoast: () => (
    <G>
      <Sun x={60} y={44} r={16} />
      <Path d="M0 150V84q60-40 130-10q30 14 36 44q-20-20-50-12q-40 10-60 44Z" fill="#1f7fbf" />
      <Path d="M130 74q30 14 36 44q-20-20-50-12" stroke="#fffdf0" strokeWidth={4} fill="none" strokeLinecap="round" />
      <Waves y={118} color="#2a8fd0" />
      {/* Lifeguard tower. */}
      <Rect x={260} y={84} width={44} height={28} fill="#fffdf0" /><Polygon points="254,84 310,84 298,70 266,70" fill="#d13a2f" />
      <Line x1={266} x2={258} y1={112} y2={150} stroke={INK} strokeWidth={3} /><Line x1={298} x2={306} y1={112} y2={150} stroke={INK} strokeWidth={3} />
    </G>
  ),
  mesa: () => (
    <G>
      <Sun x={280} y={86} r={24} c="#ffd0a0" />
      <Path d="M0 150V112h90l20-14h80l18 16h70l22-10h60V150Z" fill="#2a1f4a" />
      {/* Power lines over the canyon. */}
      {[50, 190, 330].map((x) => <G key={x}><Line x1={x} x2={x} y1={150} y2={44} stroke={INK} strokeWidth={3} /><Line x1={x - 14} x2={x + 14} y1={52} y2={52} stroke={INK} strokeWidth={3} /></G>)}
      <Path d="M36 52Q120 76 176 52M204 52Q262 76 316 52M64 52Q124 72 204 52" stroke={INK} strokeWidth={1.4} fill="none" />
      {/* Chain link. */}
      {Array.from({ length: 19 }, (_, i) => <Line key={`a${i}`} x1={i * 20} x2={i * 20 + 30} y1={150} y2={120} stroke={INK} strokeOpacity={0.55} strokeWidth={1} />)}
      {Array.from({ length: 19 }, (_, i) => <Line key={`b${i}`} x1={i * 20 + 30} x2={i * 20} y1={150} y2={120} stroke={INK} strokeOpacity={0.55} strokeWidth={1} />)}
      <Line x1={0} x2={360} y1={120} y2={120} stroke={INK} strokeWidth={2.5} />
    </G>
  ),
  east: () => (
    <G>
      <Sun x={250} y={52} r={30} c="#fff6c0" />
      <Path d="M0 150V110l50-40 40 30 46-52 54 56 40-26 60 40 70-30V150Z" fill="#7a2f1c" />
      <Path d="M0 150V124l70-16 80 14 90-18 120 20V150Z" fill="#4a1c12" />
      {[[50, 1], [300, 0.8]].map(([x, s]) => (
        <G key={x} transform={`translate(${x} 150) scale(${s})`}>
          <Path d="M0 0V-52M0 -22h-14v-16M0 -30h14v-14" stroke={INK} strokeWidth={8} strokeLinecap="round" fill="none" />
        </G>
      ))}
    </G>
  ),
  palms: () => (
    <G>
      <Sun x={180} y={96} r={30} c="#fff0b8" />
      <Path d="M0 150V124q90-24 180-10t180-8V150Z" fill="#2a1f5a" />
      <Palm x={46} h={84} /><Palm x={104} h={56} /><Palm x={268} h={70} /><Palm x={322} h={90} />
    </G>
  ),
};

/** A scenic postcard for one venue: themed sky and landmark, with the court laid out in the foreground. */
export type Daypart = 'dawn' | 'day' | 'golden' | 'night';

export function daypartAt(hour: number): Daypart {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 16) return 'day';
  if (hour >= 16 && hour < 19) return 'golden';
  return 'night';
}

/** One scene, relit: a color wash per daypart, and at night stars plus the court floodlights. */
const WASH: Record<Daypart, [string, number]> = { dawn: ['#ff9ab0', 0.2], day: ['#ffffff', 0], golden: ['#ff7a1f', 0.24], night: ['#070b24', 0.62] };
const STARS = [[24, 18], [70, 40], [118, 14], [160, 34], [214, 20], [252, 44], [300, 16], [338, 38], [44, 62], [190, 58], [280, 70], [96, 76]];

export function CourtScene({ theme, surface, width, daypart = 'day' }: { theme: Theme; surface: string | null; width: number; daypart?: Daypart }) {
  const [wash, washOpacity] = WASH[daypart];
  const court = (surface && SURFACE[surface]) || '#2f6fd6';
  const line = { stroke: '#fffdf0', strokeWidth: 1.8 } as const;
  return (
    <Svg width={width} height={width * (210 / 360)} viewBox="0 0 360 210">
      <Defs>
        <LinearGradient id={`sky-${theme.id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.sky[0]} />
          <Stop offset="1" stopColor={theme.sky[1]} />
        </LinearGradient>
      </Defs>
      <Rect width={360} height={150} fill={`url(#sky-${theme.id})`} />
      {LANDMARKS[theme.id]()}
      <Rect y={148} width={360} height={62} fill={theme.ground} />
      {/* Court in perspective. */}
      <Polygon points="96,156 264,156 322,204 38,204" fill={court} {...line} />
      <Line x1={112} x2={248} y1={156} y2={156} {...line} />
      <Line x1={117} x2={72} y1={156} y2={204} {...line} />
      <Line x1={243} x2={288} y1={156} y2={204} {...line} />
      <Line x1={104} x2={256} y1={166} y2={166} {...line} />
      <Line x1={84} x2={276} y1={190} y2={190} {...line} />
      <Line x1={180} x2={180} y1={166} y2={190} {...line} />
      <Line x1={66} x2={294} y1={176} y2={176} stroke={INK} strokeWidth={3.5} />
      <Line x1={66} x2={294} y1={175} y2={175} stroke="#fffdf0" strokeWidth={1} />
      <Rect width={360} height={210} fill={wash} opacity={washOpacity} />
      {daypart === 'night' ? (
        <G>
          {STARS.map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.6 : 1} fill="#fffdf0" opacity={0.9} />)}
          {[30, 330].map((x) => (
            <G key={x}>
              <Line x1={x} x2={x} y1={206} y2={112} stroke="#c9cede" strokeWidth={2.5} />
              <Rect x={x - 9} y={106} width={18} height={7} rx={2} fill="#fffbd6" />
              <Polygon points={`${x - 9},113 ${x + 9},113 ${x < 180 ? x + 130 : x + 40},206 ${x < 180 ? x - 40 : x - 130},206`} fill="#fffbd6" opacity={0.13} />
            </G>
          ))}
          <Polygon points="96,156 264,156 322,204 38,204" fill="#fffbd6" opacity={0.1} />
        </G>
      ) : null}
    </Svg>
  );
}
