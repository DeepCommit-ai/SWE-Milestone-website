import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Grid } from 'lucide-react';
import { T } from './theme';

interface SectionHeaderData {
  label: string;
  subtitle?: string;
  compact?: boolean;
}

const SectionHeaderNode = ({ data }: NodeProps<SectionHeaderData>) => {
  const subtitle = data.subtitle || 'Milestones with no external dependencies';
  const compact = Boolean(data.compact);

  return (
    <div
      style={{
        width: '100%',
        borderBottom: `3px solid ${T.borderSoft}`,
        paddingBottom: 16,
        marginBottom: 32,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 16,
        pointerEvents: 'none',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          color: T.muted,
          padding: compact ? 8 : 12,
        }}
      >
        <Grid size={compact ? 20 : 32} />
      </div>
      <div>
        <h2
          style={{
            fontSize: compact ? 14 : 30,
            letterSpacing: compact ? '.05em' : '.12em',
            fontWeight: 900,
            color: T.head,
            textTransform: 'uppercase',
            lineHeight: 1,
            margin: 0,
          }}
        >
          {data.label}
        </h2>
        <p style={{ fontSize: compact ? 10 : 14, marginTop: compact ? 2 : 4, color: T.muted, fontWeight: 700 }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
};

export default memo(SectionHeaderNode);
