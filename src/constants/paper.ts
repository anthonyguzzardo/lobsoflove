import { Platform } from 'react-native';

/** The paper-and-ink look of the native overlays on fighter and closet: cream cards, a hard ink shadow, mono type. */
export const P = {
  paper: '#efece5',
  card: '#fffdf8',
  ink: '#16181d',
  red: '#e2562f',
  faint: 'rgba(22,24,29,0.35)',
  dim: 'rgba(22,24,29,0.55)',
  hot: '#ff3d7f',
  ball: '#d7f205',
} as const;

export const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** A cream card with an ink border and a hard drop shadow. */
export const paperCard = {
  backgroundColor: P.card, borderRadius: 12, padding: 16, borderWidth: 2, borderColor: P.ink,
  shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 5 }, elevation: 5,
} as const;

/** An ink button that presses down onto its shadow. */
export const inkButton = {
  backgroundColor: P.ink, borderRadius: 4, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center',
  shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 },
} as const;
export const inkPressed = { transform: [{ translateY: 4 }], shadowOffset: { width: 0, height: 0 } } as const;
export const inkButtonText = { fontFamily: MONO, fontWeight: '800', fontSize: 14, letterSpacing: 1.4, color: P.paper } as const;

export const label = { fontFamily: MONO, fontWeight: '800', fontSize: 12, letterSpacing: 1.4, color: P.red } as const;
export const body = { fontFamily: MONO, fontWeight: '700', fontSize: 13, color: P.ink } as const;
export const input = { fontFamily: MONO, fontWeight: '800', fontSize: 22, color: P.ink, paddingVertical: 10, borderBottomWidth: 2.5, borderBottomColor: P.ink } as const;
