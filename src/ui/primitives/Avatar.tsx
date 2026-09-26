import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { hashString, initials } from '@/lib/text';

import { Text } from './Text';

/** Muted hues that sit well on both themes; picked deterministically by name. */
const HUES = [
  { light: ['#EDF2FE', '#3A5BC7'], dark: ['#182449', '#9EB1FF'] },
  { light: ['#E6F6EB', '#1C7A52'], dark: ['#132D21', '#3DD68C'] },
  { light: ['#FFEFD6', '#B34400'], dark: ['#331E0B', '#FFA057'] },
  { light: ['#FEE9F5', '#C2298A'], dark: ['#37172F', '#FF8DCC'] },
  { light: ['#E0F8F3', '#00786A'], dark: ['#0D2D2A', '#0BD8B6'] },
  { light: ['#F4F0FE', '#6550B9'], dark: ['#291F43', '#BAA7FF'] },
] as const;

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const { theme } = useUnistyles();
  const hue = HUES[hashString(name) % HUES.length]!;
  const [bg, fg] = theme.dark ? hue.dark : hue.light;
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
      ]}
      accessible={false}
    >
      <Text
        variant={size >= 40 ? 'calloutMedium' : 'captionMedium'}
        style={{ color: fg }}
        maxFontSizeMultiplier={1.2}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
