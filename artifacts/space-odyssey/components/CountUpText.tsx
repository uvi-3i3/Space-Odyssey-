import React, { useEffect, useRef, useState } from 'react';
import { Text, TextProps } from 'react-native';

interface CountUpTextProps extends TextProps {
  to: number;
  from?: number;
  duration?: number;
  startDelay?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  signed?: boolean;
}

export function CountUpText({
  to,
  from = 0,
  duration = 700,
  startDelay = 0,
  prefix = '',
  suffix = '',
  decimals = 0,
  signed = false,
  ...rest
}: CountUpTextProps) {
  const [value, setValue] = useState(from);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setValue(from);
    startRef.current = null;

    const startTimer = setTimeout(() => {
      if (cancelled) return;
      const step = (ts: number) => {
        if (cancelled) return;
        if (startRef.current === null) startRef.current = ts;
        const elapsed = ts - startRef.current;
        const t = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const current = from + (to - from) * eased;
        setValue(current);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        }
      };
      rafRef.current = requestAnimationFrame(step);
    }, startDelay);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [to, from, duration, startDelay]);

  const display = value.toFixed(decimals);
  const sign = signed && to > 0 ? '+' : '';
  return <Text {...rest}>{`${prefix}${sign}${display}${suffix}`}</Text>;
}
