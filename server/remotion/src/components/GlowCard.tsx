import React from 'react';
import { COLORS, FONT_DISPLAY } from '../theme';

export const GlowCard: React.FC<{
  glowColor: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ glowColor, children, style }) => {
  return (
    <div
      style={{
        background: COLORS.bgCard,
        borderRadius: 32,
        border: `1px solid ${glowColor}44`,
        boxShadow: `0 0 60px ${glowColor}55, 0 8px 32px rgba(0,0,0,0.6)`,
        padding: 48,
        fontFamily: FONT_DISPLAY,
        color: 'white',
        ...style,
      }}
    >
      {children}
    </div>
  );
};
