import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { FileCode, GitCommit, Calendar } from 'lucide-react';
import { MilestoneData, Category } from '../types';
import { T, CAT } from './theme';

const truncateId = (id: string, max = 26): string =>
  id.length <= max ? id : id.substring(0, max - 3) + '...';

const handle: React.CSSProperties = { background: T.faint, width: 8, height: 8, border: 'none' };

const MilestoneNode = ({ data, selected }: NodeProps<MilestoneData>) => {
  const cat = CAT[data.category] || CAT[Category.MAINTENANCE];

  return (
    <div
      style={{
        width: 405,
        height: 130,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: T.card,
        color: T.text,
        border: `1px solid ${selected ? T.accent : T.border}`,
        boxShadow: selected
          ? '0 0 0 3px rgba(87,171,90,0.25), 0 6px 20px rgba(0,0,0,0.45)'
          : '0 2px 8px rgba(0,0,0,0.35)',
        transition: 'all .2s',
        fontFamily: 'ui-sans-serif, system-ui, Roboto, sans-serif',
      }}
    >
      <Handle type="target" position={Position.Left} style={handle} />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '7px 12px',
          borderBottom: `1px solid ${T.borderSoft}`,
          background: T.band,
          borderRadius: '8px 8px 0 0',
        }}
      >
        <span
          title={data.id}
          style={{ fontWeight: 700, color: T.head, fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
        >
          {truncateId(data.id)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {typeof data.topoLayer === 'number' && (
            <div
              title={`Unlock layer ${data.topoLayer}`}
              style={{
                padding: '1px 6px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                color: '#9fb4ff',
                background: '#1c2540',
                border: '1px solid #2c3862',
              }}
            >
              L{data.topoLayer}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.03em',
              background: cat.bg,
              color: cat.fg,
            }}
          >
            {cat.icon}
            <span>{data.category}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 16px', flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <h3
          style={{
            fontWeight: 600,
            color: T.head,
            fontSize: 13.5,
            lineHeight: 1.3,
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {data.label}
        </h3>
      </div>

      {/* Footer / metrics */}
      <div
        style={{
          padding: '7px 12px',
          background: T.band,
          borderTop: `1px solid ${T.borderSoft}`,
          display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)',
          gap: 8,
          fontSize: 10,
          color: T.muted,
          borderRadius: '0 0 8px 8px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }} title="Commits">
          <GitCommit size={12} style={{ color: '#d9a441' }} />
          {data.commits} commits
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }} title="Source LoC">
          <FileCode size={12} style={{ color: '#6a9ecf' }} />
          src LoC: {data.srcLoc}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }} title="Date range">
          <Calendar size={12} style={{ color: '#c96b50' }} />
          {data.startDate}-{data.endDate}
        </span>
      </div>

      <Handle type="source" position={Position.Right} style={handle} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ ...handle, left: '65%' }} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" style={{ ...handle, left: '35%' }} />
    </div>
  );
};

export default memo(MilestoneNode);
