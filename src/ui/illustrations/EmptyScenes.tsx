import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';

/**
 * Empty-state scenes in the same family as EmptyDocuments: one object on a
 * 136×112 canvas, 1.5px round strokes, surface fills, and the accent used
 * for exactly one detail so the eye lands there first.
 */

type Props = { size?: number };

function usePalette() {
  const { theme } = useUnistyles();
  const c = theme.colors;
  return {
    c,
    stroke: c.border.strong,
    line: c.border.default,
    common: {
      strokeWidth: 1.5,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
    },
  };
}

function Frame({
  size = 136,
  children,
}: Props & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size * 0.82} viewBox="0 0 136 112" fill="none">
      {children}
    </Svg>
  );
}

/** A small round badge in the bottom-right, like the plus on EmptyDocuments. */
function Badge({ d }: { d: string }) {
  const { c, stroke, common } = usePalette();
  return (
    <>
      <Circle
        cx={104}
        cy={90}
        r={11}
        fill={c.bg.surface}
        stroke={stroke}
        strokeWidth={1.5}
      />
      <Path d={d} stroke={c.text.secondary} {...common} />
    </>
  );
}

const PLUS = 'M104 85v10M99 90h10';

/** Two contact cards, the front one with an avatar and name lines. */
export function EmptyClients(props: Props) {
  const { c, stroke, line, common } = usePalette();
  return (
    <Frame {...props}>
      <Rect
        x={30}
        y={20}
        width={84}
        height={54}
        rx={8}
        fill={c.bg.subtle}
        stroke={line}
        strokeWidth={1.5}
        transform="rotate(-5 72 47)"
      />
      <Rect
        x={22}
        y={32}
        width={84}
        height={54}
        rx={8}
        fill={c.bg.surface}
        stroke={stroke}
        strokeWidth={1.5}
      />
      <Circle
        cx={42}
        cy={52}
        r={9}
        fill={c.accent.subtle}
        stroke={c.accent.border}
        strokeWidth={1.5}
      />
      <Circle cx={42} cy={49} r={3} stroke={c.accent.solid} strokeWidth={1.5} />
      <Path d="M36 58a6 6 0 0 1 12 0" stroke={c.accent.solid} {...common} />
      <Path
        d="M58 48h32M58 55h20M34 72h30M72 72h20"
        stroke={line}
        {...common}
      />
      <Badge d={PLUS} />
    </Frame>
  );
}

/** A price tag on a short catalog list. */
export function EmptyItems(props: Props) {
  const { c, stroke, line, common } = usePalette();
  return (
    <Frame {...props}>
      <Rect
        x={22}
        y={16}
        width={76}
        height={80}
        rx={8}
        fill={c.bg.surface}
        stroke={stroke}
        strokeWidth={1.5}
      />
      <Path
        d="M34 32h30M84 32h4M34 46h24M84 46h4M34 60h34M84 60h4"
        stroke={line}
        {...common}
      />
      <Path d="M22 76h76" stroke={line} strokeWidth={1} />
      <Path
        d="M78 62l22 0a4 4 0 0 1 4 4v16a4 4 0 0 1 -4 4h-22l-10 -12z"
        fill={c.accent.subtle}
        stroke={c.accent.border}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Circle cx={79} cy={74} r={2.5} fill={c.accent.solid} />
      <Path d="M88 71h10M88 77h6" stroke={c.accent.solid} {...common} />
    </Frame>
  );
}

/** A torn-off receipt with a paperclip. */
export function EmptyExpenses(props: Props) {
  const { c, stroke, line, common } = usePalette();
  const teeth = 'l-4.25 4l-4.25 -4'.repeat(8);
  return (
    <Frame {...props}>
      <Path
        d={`M38 14h60a4 4 0 0 1 4 4v80${teeth}V18a4 4 0 0 1 4 -4z`}
        fill={c.bg.surface}
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M48 30h24M48 44h28M88 44h4M48 54h20M88 54h4M48 64h24M88 64h4"
        stroke={line}
        {...common}
      />
      <Path
        d="M48 76h44"
        stroke={line}
        strokeWidth={1}
        strokeDasharray="2 3"
        strokeLinecap="round"
      />
      <Rect x={66} y={80} width={28} height={9} rx={3} fill={c.accent.subtle} />
      <Path d="M71 84.5h18" stroke={c.accent.solid} {...common} />
      <Path
        d="M88 8v18a5 5 0 0 1 -10 0V12a3 3 0 0 1 6 0v13"
        stroke={c.text.tertiary}
        {...common}
      />
    </Frame>
  );
}

/** A winding route between two pins. */
export function EmptyMileage(props: Props) {
  const { c, stroke, line, common } = usePalette();
  return (
    <Frame {...props}>
      <Rect
        x={18}
        y={14}
        width={100}
        height={84}
        rx={10}
        fill={c.bg.surface}
        stroke={stroke}
        strokeWidth={1.5}
      />
      <Path d="M18 44h30M88 78h30M62 14v22" stroke={line} strokeWidth={1} />
      <Path
        d="M40 78c0 -14 18 -10 26 -22s18 -16 30 -18"
        stroke={c.accent.solid}
        strokeDasharray="4 4"
        {...common}
      />
      <Circle
        cx={40}
        cy={80}
        r={4}
        fill={c.bg.surface}
        stroke={c.text.secondary}
        strokeWidth={1.5}
      />
      <Path
        d="M96 40c-6 -6 -9 -10 -9 -14a9 9 0 0 1 18 0c0 4 -3 8 -9 14z"
        fill={c.accent.subtle}
        stroke={c.accent.border}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Circle cx={96} cy={26} r={3} fill={c.accent.solid} />
    </Frame>
  );
}

/** A bank card with a QR corner: how clients pay you. */
export function EmptyPayments(props: Props) {
  const { c, stroke, line, common } = usePalette();
  return (
    <Frame {...props}>
      <Rect
        x={20}
        y={26}
        width={88}
        height={58}
        rx={8}
        fill={c.bg.surface}
        stroke={stroke}
        strokeWidth={1.5}
      />
      <Path d="M20 40h88" stroke={line} strokeWidth={1} />
      <Path d="M30 56h40M30 66h24" stroke={line} {...common} />
      <Rect
        x={80}
        y={52}
        width={18}
        height={18}
        rx={3}
        fill={c.accent.subtle}
        stroke={c.accent.border}
        strokeWidth={1.5}
      />
      <Path
        d="M85 57h3v3h-3zM90 62h3v3h-3zM85 65h0M93 57h0"
        stroke={c.accent.solid}
        {...common}
      />
      <Badge d={PLUS} />
    </Frame>
  );
}

/** A spreadsheet with an arrow coming in. */
export function EmptyImport(props: Props) {
  const { c, stroke, line, common } = usePalette();
  return (
    <Frame {...props}>
      <Rect
        x={40}
        y={14}
        width={76}
        height={84}
        rx={8}
        fill={c.bg.surface}
        stroke={stroke}
        strokeWidth={1.5}
      />
      <Path
        d="M40 32h76M40 50h76M40 68h76M68 14v84"
        stroke={line}
        strokeWidth={1}
      />
      <Path
        d="M48 23h12M76 23h24M48 41h10M76 41h28M48 59h14M76 59h20M48 77h8M76 77h26"
        stroke={line}
        {...common}
      />
      <Circle
        cx={30}
        cy={56}
        r={14}
        fill={c.accent.subtle}
        stroke={c.accent.border}
        strokeWidth={1.5}
      />
      <Path d="M24 56h12M31 51l5 5l-5 5" stroke={c.accent.solid} {...common} />
    </Frame>
  );
}

/** Three bars and a trend line. */
export function EmptyReports(props: Props) {
  const { c, stroke, line, common } = usePalette();
  return (
    <Frame {...props}>
      <Rect
        x={20}
        y={14}
        width={96}
        height={84}
        rx={8}
        fill={c.bg.surface}
        stroke={stroke}
        strokeWidth={1.5}
      />
      <Path d="M32 84h72" stroke={line} strokeWidth={1} />
      <Rect
        x={38}
        y={62}
        width={12}
        height={22}
        rx={3}
        fill={c.bg.subtle}
        stroke={line}
        strokeWidth={1.5}
      />
      <Rect
        x={62}
        y={50}
        width={12}
        height={34}
        rx={3}
        fill={c.bg.subtle}
        stroke={line}
        strokeWidth={1.5}
      />
      <Rect
        x={86}
        y={38}
        width={12}
        height={46}
        rx={3}
        fill={c.accent.subtle}
        stroke={c.accent.border}
        strokeWidth={1.5}
      />
      <Path d="M36 50l20 -8l20 -6l22 -12" stroke={c.accent.solid} {...common} />
      <Path d="M32 26h22" stroke={line} {...common} />
    </Frame>
  );
}
