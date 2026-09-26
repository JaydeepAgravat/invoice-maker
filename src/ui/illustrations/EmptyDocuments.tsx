import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';

/**
 * Two stacked invoices, the front one with a line-item table and a total bar.
 * Drawn at 1.5px round strokes to sit in the same family as the Lucide icons.
 * Theme-aware: uses surface fills and the accent only for the total.
 */
export function EmptyDocuments({ size = 136 }: { size?: number }) {
  const { theme } = useUnistyles();
  const c = theme.colors;
  const stroke = c.border.strong;
  const line = c.border.default;

  return (
    <Svg width={size} height={size * 0.82} viewBox="0 0 136 112" fill="none">
      {/* Back sheet */}
      <Rect
        x={34}
        y={8}
        width={72}
        height={92}
        rx={8}
        fill={c.bg.subtle}
        stroke={line}
        strokeWidth={1.5}
        transform="rotate(6 70 54)"
      />
      {/* Front sheet */}
      <Rect x={26} y={14} width={72} height={92} rx={8} fill={c.bg.surface} stroke={stroke} strokeWidth={1.5} />
      {/* Header: logo dot + title lines */}
      <Circle cx={39} cy={28} r={5} fill={c.accent.subtle} stroke={c.accent.border} strokeWidth={1.5} />
      <Path d="M50 26h20M50 31h12" stroke={line} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M78 26h10" stroke={line} strokeWidth={1.5} strokeLinecap="round" />
      {/* Line items */}
      <Path d="M36 46h52" stroke={line} strokeWidth={1} strokeLinecap="round" strokeDasharray="0.01 0" />
      <Path d="M36 54h26M78 54h10M36 63h32M78 63h10M36 72h20M78 72h10" stroke={line} strokeWidth={1.5} strokeLinecap="round" />
      {/* Total bar */}
      <Rect x={60} y={84} width={30} height={10} rx={3} fill={c.accent.subtle} />
      <Path d="M65 89h20" stroke={c.accent.solid} strokeWidth={1.5} strokeLinecap="round" />
      {/* Plus badge */}
      <Circle cx={100} cy={96} r={11} fill={c.bg.surface} stroke={stroke} strokeWidth={1.5} />
      <Path d="M100 91v10M95 96h10" stroke={c.text.secondary} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}
