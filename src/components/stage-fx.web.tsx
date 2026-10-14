import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/** Web/SSR fallback: the native shader requires CanvasKit before module evaluation. */
export function StageFx({ color, width, height }: { color: string; width: number; height: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs><LinearGradient id="stageTint" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#141a2b" /><Stop offset="1" stopColor={color} stopOpacity={0.3} />
        </LinearGradient></Defs>
        <Rect width={width} height={height} fill="#141a2b" />
        <Path d={`M${width * 0.58} 0H${width}V${height}H${width * 0.26}Z`} fill="url(#stageTint)" />
        <Path d={`M${width * 0.58} 0L${width * 0.26} ${height}`} stroke={color} strokeWidth={2} opacity={0.6} />
      </Svg>
    </View>
  );
}
