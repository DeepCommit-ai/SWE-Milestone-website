import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { MilestoneData, Category } from '../types';
import { T, CAT } from './theme';

// Group container (dashed box around sub-milestones). In the embed we flatten
// groups before render, so this is rarely shown, but kept dark-styled for parity.
const invisibleHandle: React.CSSProperties = { background: 'transparent', width: 1, height: 1, border: 'none' };

const GroupMilestoneNode = ({ data, selected }: NodeProps<MilestoneData>) => {
  const cat = CAT[data.category] || CAT[Category.MAINTENANCE];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 8,
        position: 'relative',
        background: 'rgba(26,31,38,0.35)',
        border: `2px dashed ${selected ? T.accent : T.borderSoft}`,
      }}
    >
      <Handle type="target" position={Position.Left} style={invisibleHandle} />
      <div style={{ position: 'absolute', top: 4, left: 8, display: 'flex', alignItems: 'center', gap: 6, opacity: 0.8 }}>
        <span style={{ fontWeight: 600, color: T.muted, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
          {data.id}
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '1px 6px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            background: cat.bg,
            color: cat.fg,
          }}
        >
          {cat.icon}
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={invisibleHandle} />
    </div>
  );
};

export default memo(GroupMilestoneNode);
