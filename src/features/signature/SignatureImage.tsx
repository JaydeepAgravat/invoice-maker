import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import NativeMedia from '@/specs/NativeMedia';

/** Shows a saved signature SVG from the app's private files. */
export function SignatureImage({
  path,
  width,
  height,
}: {
  path: string;
  width: number;
  height: number;
}) {
  const [xml, setXml] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    NativeMedia?.readFile(path)
      .then(s => alive && setXml(s))
      .catch(() => alive && setXml(null));
    return () => {
      alive = false;
    };
  }, [path]);
  return xml ? (
    <SvgXml xml={xml} width={width} height={height} />
  ) : (
    <View style={{ width, height }} />
  );
}
