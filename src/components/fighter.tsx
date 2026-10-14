import Svg, { Circle, Defs, Ellipse, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { CastId } from '@/lib/roster';

const INK = '#0b0f1a';
const EYE = '#fffdf0';

/** Where the face sits for each body, in the 200x200 box. */
const FACE: Record<CastId, { x: number; y: number }> = {
  wall: { x: 100, y: 92 }, moon: { x: 78, y: 96 }, bot: { x: 100, y: 78 }, goblin: { x: 100, y: 100 },
  grunter: { x: 100, y: 86 }, junk: { x: 100, y: 108 }, comet: { x: 112, y: 104 }, ghost: { x: 100, y: 88 },
  lobber: { x: 100, y: 64 }, rabbit: { x: 100, y: 120 },
};

function Body({ cast, color }: { cast: CastId; color: string }) {
  switch (cast) {
    case 'wall':
      return (
        <G>
          <Rect x={38} y={36} width={124} height={130} rx={10} fill={color} />
          {[68, 100, 132].map((y) => <Line key={y} x1={38} x2={162} y1={y} y2={y} stroke={INK} strokeOpacity={0.22} strokeWidth={4} />)}
          {[[80, 36, 68], [124, 36, 68], [60, 132, 166], [104, 132, 166], [146, 132, 166]].map(([x, a, b]) => (
            <Line key={`${x}-${a}`} x1={x} x2={x} y1={a} y2={b} stroke={INK} strokeOpacity={0.22} strokeWidth={4} />
          ))}
        </G>
      );
    case 'moon':
      return <Path d="M132 24 A78 78 0 1 0 132 176 A60 60 0 1 1 132 24Z" fill={color} />;
    case 'bot':
      return (
        <G>
          <Line x1={100} x2={100} y1={14} y2={38} stroke={color} strokeWidth={6} strokeLinecap="round" />
          <Circle cx={100} cy={14} r={8} fill={color} />
          <Rect x={46} y={38} width={108} height={82} rx={16} fill={color} />
          <Rect x={62} y={126} width={76} height={46} rx={10} fill={color} />
          <Rect x={30} y={66} width={12} height={28} rx={5} fill={color} />
          <Rect x={158} y={66} width={12} height={28} rx={5} fill={color} />
        </G>
      );
    case 'goblin':
      return (
        <G>
          <Path d="M48 96 8 62 52 74Z M152 96 192 62 148 74Z" fill={color} />
          <Ellipse cx={100} cy={106} rx={58} ry={62} fill={color} />
        </G>
      );
    case 'grunter':
      return <Circle cx={100} cy={100} r={72} fill={color} />;
    case 'junk':
      return (
        <G>
          <Rect x={40} y={46} width={120} height={16} rx={8} fill={color} />
          <Rect x={86} y={32} width={28} height={16} rx={6} fill={color} />
          <Path d="M48 68H152L142 174H58Z" fill={color} />
          {[78, 100, 122].map((x) => <Line key={x} x1={x} x2={x} y1={132} y2={166} stroke={INK} strokeOpacity={0.22} strokeWidth={4} strokeLinecap="round" />)}
        </G>
      );
    case 'comet':
      return (
        <G>
          <Path d="M18 34 96 70 60 84 26 60 74 110 22 96 70 140Z" fill={color} opacity={0.55} />
          <Circle cx={112} cy={110} r={60} fill={color} />
        </G>
      );
    case 'ghost':
      return <Path d="M42 176V88a58 58 0 0 1 116 0v88l-23-14-18 16-17-16-17 16-18-16Z" fill={color} opacity={0.82} />;
    case 'lobber':
      // An arch: the path of a lob.
      return <Path d="M24 176V120a76 76 0 0 1 152 0v56h-42v-56a34 34 0 0 0-68 0v56Z" fill={color} />;
    case 'rabbit':
      return (
        <G>
          <Ellipse cx={74} cy={52} rx={15} ry={40} fill={color} />
          <Ellipse cx={126} cy={52} rx={15} ry={40} fill={color} />
          <Ellipse cx={100} cy={124} rx={62} ry={54} fill={color} />
        </G>
      );
  }
}

/** Mixes a hex color toward white (t > 0) or toward the ink (t < 0). */
function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const to = t > 0 ? [255, 255, 255] : [11, 15, 26];
  const k = Math.abs(t);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v + (to[i] - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function FighterAvatar({ cast, color, size }: { cast: CastId; color: string; size: number }) {
  const f = FACE[cast];
  const gid = `body-${cast}-${color.slice(1)}`;
  const shout = cast === 'grunter';
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Ellipse cx={100} cy={186} rx={56} ry={7} fill="#000" opacity={0.28} />
      <Defs>
        {/* Key light from the upper left: lit crown, true color mid-body, shadowed underside. */}
        <RadialGradient id={gid} cx="34%" cy="26%" r="85%" fx="34%" fy="26%">
          <Stop offset="0" stopColor={shade(color, 0.45)} />
          <Stop offset="0.45" stopColor={color} />
          <Stop offset="1" stopColor={shade(color, -0.42)} />
        </RadialGradient>
      </Defs>
      <Body cast={cast} color={`url(#${gid})`} />
      <Ellipse cx={f.x - 20} cy={f.y} rx={9} ry={12} fill={EYE} />
      <Ellipse cx={f.x + 20} cy={f.y} rx={9} ry={12} fill={EYE} />
      <Ellipse cx={f.x - 18} cy={f.y + 2} rx={4.5} ry={6.5} fill={INK} />
      <Ellipse cx={f.x + 22} cy={f.y + 2} rx={4.5} ry={6.5} fill={INK} />
      {cast === 'bot' ? (
        <Rect x={f.x - 20} y={f.y + 22} width={40} height={7} rx={3} fill={INK} />
      ) : shout ? (
        <Ellipse cx={f.x} cy={f.y + 36} rx={22} ry={20} fill={INK} />
      ) : (
        <Path d={`M${f.x - 13} ${f.y + 24}q13 14 26 0`} fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      )}
      {cast === 'goblin' ? <Path d={`M${f.x - 32} ${f.y - 20}l22 8 M${f.x + 32} ${f.y - 20}l-22 8`} stroke={INK} strokeWidth={5} strokeLinecap="round" /> : null}
    </Svg>
  );
}
