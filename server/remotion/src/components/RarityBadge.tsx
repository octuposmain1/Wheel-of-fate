import React from 'react';

export const RarityBadge: React.FC<{
  label: string;
  color: string;
  scale?: number;
}> = ({ label, color, scale = 1 }) => {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8 * scale,
        padding: `${4 * scale}px ${14 * scale}px`,
        borderRadius: 9999,
        background: `${color}22`,
        border: `1px solid ${color}88`,
        color,
        fontSize: 22 * scale,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      <span
        style={{
          width: 10 * scale,
          height: 10 * scale,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 ${6 * scale}px ${color}`,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
};
