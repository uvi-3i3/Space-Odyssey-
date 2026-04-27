import React, { useEffect, useRef, useState } from 'react';
import { Text, TextProps } from 'react-native';

interface TypewriterProps extends TextProps {
  text: string;
  speed?: number;
  startDelay?: number;
  enabled?: boolean;
  onDone?: () => void;
}

/**
 * Lightweight decode/typewriter effect. Reveals characters in chunks for
 * speed and to feel like data decoding rather than slow typing.
 */
export function Typewriter({
  text,
  speed = 18,
  startDelay = 0,
  enabled = true,
  onDone,
  ...rest
}: TypewriterProps) {
  const [shown, setShown] = useState(enabled ? '' : text);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setShown(text);
      return;
    }
    indexRef.current = 0;
    setShown('');
    let cancelled = false;
    const startAt = setTimeout(() => {
      const chunk = Math.max(1, Math.round(text.length / 60));
      const tick = () => {
        if (cancelled) return;
        indexRef.current = Math.min(text.length, indexRef.current + chunk);
        setShown(text.slice(0, indexRef.current));
        if (indexRef.current < text.length) {
          setTimeout(tick, speed);
        } else if (onDone) {
          onDone();
        }
      };
      tick();
    }, startDelay);
    return () => {
      cancelled = true;
      clearTimeout(startAt);
    };
  }, [text, speed, startDelay, enabled]);

  return <Text {...rest}>{shown}</Text>;
}
