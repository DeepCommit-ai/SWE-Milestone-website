import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { CircleOff, FileCode, GitCommit, Calendar } from 'lucide-react';
import { MilestoneData, Category } from '../types';
import { T, CAT } from './theme';

const truncateId = (id: string, max = 30): string =>
  id.length <= max ? id : id.substring(0, max - 3) + '...';

const handle: React.CSSProperties = { background: T.faint, width: 9, height: 9, border: 'none' };
const compactCategory: Partial<Record<Category, string>> = {
  [Category.PLATFORM_SUPPORT]: 'PLATFORM',
  [Category.BREAKING_CHANGE]: 'BREAKING',
};

const MilestoneNode = ({ data, selected }: NodeProps<MilestoneData>) => {
  const cat = CAT[data.category] || CAT[Category.MAINTENANCE];

  return (
    <div
      style={{
        width: 480,
        height: 158,
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
          padding: '9px 15px',
          borderBottom: `1px solid ${T.borderSoft}`,
          background: T.band,
          borderRadius: '8px 8px 0 0',
        }}
      >
        <span
          title={data.id}
          style={{ fontWeight: 700, color: T.head, fontFamily: 'ui-monospace, monospace', fontSize: 17.5 }}
        >
          {truncateId(data.id)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {typeof data.topoLayer === 'number' && (
            <div
              title={`Unlock layer ${data.topoLayer}`}
              style={{
                padding: '2px 7px',
                borderRadius: 6,
                fontSize: 13.5,
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
              gap: 5,
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: 13.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.03em',
              background: cat.bg,
              color: cat.fg,
            }}
          >
            {cat.icon}
            <span title={data.category}>{compactCategory[data.category] || data.category}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          padding: '11px 20px', flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12, overflow: 'hidden',
        }}
      >
        <h3
          style={{
            fontWeight: 700,
            color: T.head,
            fontSize: 18,
            lineHeight: 1.3,
            margin: 0,
            flex: 1,
            minWidth: 0,
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
          padding: '9px 15px',
          background: T.band,
          borderTop: `1px solid ${T.borderSoft}`,
          display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)',
          gap: 10,
          fontSize: 14,
          fontWeight: 600,
          color: T.muted,
          borderRadius: '0 0 8px 8px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Commits">
          <GitCommit size={14} style={{ color: '#d9a441', flex: 'none' }} />
          {data.commits} commits
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Source LoC">
          <FileCode size={14} style={{ color: '#6a9ecf', flex: 'none' }} />
          src LoC: {data.srcLoc}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Date range">
          <Calendar size={14} style={{ color: '#c96b50', flex: 'none' }} />
          {data.startDate}-{data.endDate}
        </span>
      </div>

      {data.isNonGraded && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 8,
              pointerEvents: 'none',
              borderRadius: 8,
              background: 'rgba(5, 8, 11, 0.72)',
              border: `3px dashed ${selected ? T.accent : '#8b949e'}`,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
            }}
          />
          <div
            title="Implemented by the agent but excluded from benchmark scoring"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              zIndex: 9,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              width: '66%',
              minHeight: 42,
              padding: '8px 14px',
              borderRadius: 4,
              border: '2px solid #9aa4af',
              background: '#252c34',
              color: '#f0f6fc',
              boxShadow: '0 3px 12px rgba(0,0,0,0.55)',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 20,
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: 0,
              whiteSpace: 'nowrap',
            }}
          >
            <CircleOff size={21} aria-hidden="true" />
            NON-GRADED
          </div>
        </>
      )}

      <Handle type="source" position={Position.Right} style={handle} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ ...handle, left: '65%' }} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" style={{ ...handle, left: '35%' }} />
    </div>
  );
};

export default memo(MilestoneNode);
