import React, { memo } from 'react';
import { BaseEdge, EdgeProps } from 'reactflow';

const CONTROL_X_OFFSET = 150;

const WideAdditionalEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  data,
}: EdgeProps) => {
  const routeY =
    typeof data?.extraRouteY === 'number' ? data.extraRouteY : Math.min(sourceY, targetY) - 220;

  const leftToRight = sourceX <= targetX;
  const sourceControlX = sourceX + (leftToRight ? CONTROL_X_OFFSET : -CONTROL_X_OFFSET);
  const targetControlX = targetX + (leftToRight ? -CONTROL_X_OFFSET : CONTROL_X_OFFSET);
  const midX = (sourceX + targetX) / 2;

  // Draw a very wide two-segment cubic arc that travels through a dedicated outer routeY lane.
  const path = [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceControlX} ${sourceY}, ${sourceControlX} ${routeY}, ${midX} ${routeY}`,
    `C ${targetControlX} ${routeY}, ${targetControlX} ${targetY}, ${targetX} ${targetY}`,
  ].join(' ');

  return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />;
};

export default memo(WideAdditionalEdge);
