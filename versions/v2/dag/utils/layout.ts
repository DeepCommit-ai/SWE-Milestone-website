import dagre from 'dagre';
import { Edge, Node, Position } from 'reactflow';

const DEFAULT_NODE_WIDTH = 480; // Match MilestoneNode width
const DEFAULT_NODE_HEIGHT = 158; // Match MilestoneNode height

// Padding for group containers
const GROUP_PADDING_LEFT = 10;
const GROUP_PADDING_RIGHT = 10;
const GROUP_PADDING_TOP = 36; // Extra space for group label
const GROUP_PADDING_BOTTOM = 10;

const TOPO_COL_WIDTH = DEFAULT_NODE_WIDTH + 95;
const TOPO_ROW_HEIGHT = DEFAULT_NODE_HEIGHT + 50;
const TOPO_HEADER_HEIGHT = 56;
const TOPO_NODE_START_Y = 108;
const TOPO_COLUMN_STAGGER_PATTERN = [0, 108, 42, 156, 78, 132];

export type ViewMode = 'structure' | 'topology';

export interface LayoutOptions {
  viewMode?: ViewMode;
  expandSubMilestones?: boolean;
}

export interface LayoutMetadata {
  effectiveViewMode: ViewMode;
  topology?: {
    layerCount: number;
    criticalDepth: number;
    hasCycle: boolean;
  };
}

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
  metadata: LayoutMetadata;
}

// Helper to run dagre on a specific set of nodes and edges
const runDagreLayout = (
  nodes: Node[],
  edges: Edge[],
  direction = 'LR',
  nodeWidth = DEFAULT_NODE_WIDTH,
  nodeHeight = DEFAULT_NODE_HEIGHT
) => {
  if (nodes.length === 0) return [];

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 95, // Horizontal separation between columns
    nodesep: 50, // Vertical separation between nodes
    edgesep: 36, // Minimum separation between edges
    ranker: 'network-simplex',
    align: 'UL', // Align nodes to upper-left to keep rows aligned
    marginx: 0,
    marginy: 0,
  });

  nodes.forEach((node) => {
    // Use custom dimensions for group nodes, default for others
    const w = node.style?.width && typeof node.style.width === 'number' ? node.style.width : nodeWidth;
    const h = node.style?.height && typeof node.style.height === 'number' ? node.style.height : nodeHeight;
    dagreGraph.setNode(node.id, { width: w, height: h });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) return node;

    const w = node.style?.width && typeof node.style.width === 'number' ? node.style.width : nodeWidth;
    const h = node.style?.height && typeof node.style.height === 'number' ? node.style.height : nodeHeight;

    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: {
        x: nodeWithPosition.x - w / 2,
        y: nodeWithPosition.y - h / 2,
      },
    };
  });

  return layoutedNodes;
};

// Group mode layout: groups are treated as single nodes, children layout internally
const getGroupModeLayout = (nodes: Node[], edges: Edge[], direction: string): LayoutResult => {
  const groupNodes = nodes.filter((n) => n.type === 'groupMilestone');
  const childNodesMap = new Map<string, Node[]>();
  const topLevelNodes = nodes.filter((n) => !n.parentNode);

  // Group children by parent
  nodes.forEach((node) => {
    if (node.parentNode) {
      if (!childNodesMap.has(node.parentNode)) {
        childNodesMap.set(node.parentNode, []);
      }
      childNodesMap.get(node.parentNode)?.push(node);
    }
  });

  // PASS 1: INTERNAL LAYOUT - layout children inside groups first
  let processedChildNodes: Node[] = [];

  groupNodes.forEach((group) => {
    const children = childNodesMap.get(group.id) || [];

    if (children.length === 0) {
      group.style = { width: 400, height: 200 };
      return;
    }

    const childIds = new Set(children.map((c) => c.id));
    const internalEdges = edges.filter((e) => childIds.has(e.source) && childIds.has(e.target));

    const layoutedChildren = runDagreLayout(children, internalEdges, 'LR');

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    layoutedChildren.forEach((child) => {
      if (child.position.x < minX) minX = child.position.x;
      if (child.position.y < minY) minY = child.position.y;
      if (child.position.x + DEFAULT_NODE_WIDTH > maxX) maxX = child.position.x + DEFAULT_NODE_WIDTH;
      if (child.position.y + DEFAULT_NODE_HEIGHT > maxY) maxY = child.position.y + DEFAULT_NODE_HEIGHT;
    });

    const groupWidth = maxX - minX + GROUP_PADDING_LEFT + GROUP_PADDING_RIGHT;
    const groupHeight = maxY - minY + GROUP_PADDING_TOP + GROUP_PADDING_BOTTOM;

    group.style = { width: groupWidth, height: groupHeight };

    const offsetX = GROUP_PADDING_LEFT - minX;
    const offsetY = GROUP_PADDING_TOP - minY;

    layoutedChildren.forEach((child) => {
      child.position.x += offsetX;
      child.position.y += offsetY;
      processedChildNodes.push(child);
    });
  });

  // PASS 2: Resolve edges to top-level parents
  const nodeParentMap = new Map<string, string>();
  nodes.forEach((node) => {
    if (node.parentNode) {
      nodeParentMap.set(node.id, node.parentNode);
    } else {
      nodeParentMap.set(node.id, node.id);
    }
  });

  const connectedNodeIds = new Set<string>();
  const effectiveEdges: Edge[] = [];
  const addedEdgeKeys = new Set<string>();

  edges.forEach((edge) => {
    const sourceId = nodeParentMap.get(edge.source);
    const targetId = nodeParentMap.get(edge.target);

    if (sourceId && targetId && sourceId !== targetId) {
      connectedNodeIds.add(sourceId);
      connectedNodeIds.add(targetId);

      const key = `${sourceId}-${targetId}`;
      if (!addedEdgeKeys.has(key)) {
        effectiveEdges.push({
          id: `layout-e-${key}`,
          source: sourceId,
          target: targetId,
        });
        addedEdgeKeys.add(key);
      }
    }
  });

  const connectedNodes: Node[] = [];
  const isolatedNodes: Node[] = [];

  topLevelNodes.forEach((node) => {
    if (connectedNodeIds.has(node.id) || node.type === 'groupMilestone') {
      connectedNodes.push(node);
    } else {
      isolatedNodes.push(node);
    }
  });

  // PASS 3: GLOBAL DAG LAYOUT
  const layoutedConnected = runDagreLayout(connectedNodes, effectiveEdges, direction);

  // PASS 4: GRID LAYOUT for isolated
  let maxY = 0;
  if (layoutedConnected.length > 0) {
    layoutedConnected.forEach((n) => {
      const h = n.style?.height && typeof n.style.height === 'number' ? n.style.height : DEFAULT_NODE_HEIGHT;
      const bottom = n.position.y + h;
      if (bottom > maxY) maxY = bottom;
    });
  }

  const GRID_START_Y = maxY > 0 ? maxY + 300 : 100;
  const COLUMNS = 3;
  const COL_WIDTH = DEFAULT_NODE_WIDTH + 72;
  const ROW_HEIGHT = DEFAULT_NODE_HEIGHT + 45;

  const finalNodes = [...layoutedConnected, ...processedChildNodes];

  if (isolatedNodes.length > 0) {
    finalNodes.push({
      id: 'isolated-section-header',
      type: 'sectionHeader',
      data: { label: 'Independent Milestones' },
      position: { x: 0, y: GRID_START_Y - 100 },
      draggable: false,
      selectable: false,
      style: { width: COLUMNS * COL_WIDTH, height: 60, pointerEvents: 'none' },
    });

    isolatedNodes.forEach((node, index) => {
      const col = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);

      node.position = {
        x: col * COL_WIDTH,
        y: GRID_START_Y + row * ROW_HEIGHT,
      };

      node.targetPosition = Position.Left;
      node.sourcePosition = Position.Right;

      finalNodes.push(node);
    });
  }

  return {
    nodes: finalNodes,
    edges,
    metadata: {
      effectiveViewMode: 'structure',
    },
  };
};

// Child mode layout: children participate in global layout, groups wrap around them
const getChildModeLayout = (nodes: Node[], edges: Edge[], direction: string): LayoutResult => {
  const groupNodes = nodes.filter((n) => n.type === 'groupMilestone');
  const milestoneNodes = nodes.filter((n) => n.type !== 'groupMilestone');

  const childToParent = new Map<string, string>();
  nodes.forEach((node) => {
    if (node.parentNode) {
      childToParent.set(node.id, node.parentNode);
    }
  });

  const connectedNodeIds = new Set<string>();
  edges.forEach((edge) => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  const connectedMilestones: Node[] = [];
  const isolatedMilestones: Node[] = [];

  milestoneNodes.forEach((node) => {
    if (connectedNodeIds.has(node.id)) {
      connectedMilestones.push(node);
    } else {
      const parentId = childToParent.get(node.id);
      if (parentId) {
        const groupHasConnectedChild = milestoneNodes.some(
          (n) => childToParent.get(n.id) === parentId && connectedNodeIds.has(n.id)
        );
        if (groupHasConnectedChild) {
          connectedMilestones.push(node);
        } else {
          isolatedMilestones.push(node);
        }
      } else {
        isolatedMilestones.push(node);
      }
    }
  });

  const layoutedConnected = runDagreLayout(connectedMilestones, edges, direction);

  const positionMap = new Map<string, { x: number; y: number }>();
  layoutedConnected.forEach((node) => {
    positionMap.set(node.id, { ...node.position });
  });

  const finalNodes: Node[] = [];
  const processedGroups = new Set<string>();

  groupNodes.forEach((group) => {
    const children = layoutedConnected.filter((n) => childToParent.get(n.id) === group.id);

    if (children.length === 0) {
      return;
    }

    processedGroups.add(group.id);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    children.forEach((child) => {
      const pos = positionMap.get(child.id)!;
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x + DEFAULT_NODE_WIDTH > maxX) maxX = pos.x + DEFAULT_NODE_WIDTH;
      if (pos.y + DEFAULT_NODE_HEIGHT > maxY) maxY = pos.y + DEFAULT_NODE_HEIGHT;
    });

    const groupX = minX - GROUP_PADDING_LEFT;
    const groupY = minY - GROUP_PADDING_TOP;
    const groupWidth = maxX - minX + GROUP_PADDING_LEFT + GROUP_PADDING_RIGHT;
    const groupHeight = maxY - minY + GROUP_PADDING_TOP + GROUP_PADDING_BOTTOM;

    finalNodes.push({
      ...group,
      position: { x: groupX, y: groupY },
      style: { width: groupWidth, height: groupHeight },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    });

    children.forEach((child) => {
      const globalPos = positionMap.get(child.id)!;
      finalNodes.push({
        ...child,
        position: {
          x: globalPos.x - groupX,
          y: globalPos.y - groupY,
        },
      });
    });
  });

  layoutedConnected.forEach((node) => {
    const parentId = childToParent.get(node.id);
    if (!parentId) {
      finalNodes.push(node);
    }
  });

  let maxY = 0;
  finalNodes.forEach((n) => {
    const h = n.style?.height && typeof n.style.height === 'number' ? n.style.height : DEFAULT_NODE_HEIGHT;
    const bottom = n.position.y + h;
    if (bottom > maxY) maxY = bottom;
  });

  const GRID_START_Y = maxY > 0 ? maxY + 300 : 100;
  const COLUMNS = 3;
  const COL_WIDTH = DEFAULT_NODE_WIDTH + 72;
  const ROW_HEIGHT = DEFAULT_NODE_HEIGHT + 45;

  const isolatedTopLevel = isolatedMilestones.filter((n) => !childToParent.has(n.id));

  groupNodes.forEach((group) => {
    if (!processedGroups.has(group.id)) {
      const children = milestoneNodes.filter((n) => childToParent.get(n.id) === group.id);

      if (children.length > 0) {
        const internalEdges = edges.filter(
          (e) => childToParent.get(e.source) === group.id && childToParent.get(e.target) === group.id
        );
        const layoutedChildren = runDagreLayout(children, internalEdges, 'LR');

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        layoutedChildren.forEach((child) => {
          if (child.position.x < minX) minX = child.position.x;
          if (child.position.y < minY) minY = child.position.y;
          if (child.position.x + DEFAULT_NODE_WIDTH > maxX) maxX = child.position.x + DEFAULT_NODE_WIDTH;
          if (child.position.y + DEFAULT_NODE_HEIGHT > maxY) maxY = child.position.y + DEFAULT_NODE_HEIGHT;
        });

        const groupWidth = maxX - minX + GROUP_PADDING_LEFT + GROUP_PADDING_RIGHT;
        const groupHeight = maxY - minY + GROUP_PADDING_TOP + GROUP_PADDING_BOTTOM;

        const gridIndex = isolatedTopLevel.length + Array.from(processedGroups).indexOf(group.id);
        const col = gridIndex % COLUMNS;
        const row = Math.floor(gridIndex / COLUMNS);

        const groupX = col * COL_WIDTH;
        const groupY = GRID_START_Y + row * ROW_HEIGHT;

        finalNodes.push({
          ...group,
          position: { x: groupX, y: groupY },
          style: { width: groupWidth, height: groupHeight },
          targetPosition: Position.Left,
          sourcePosition: Position.Right,
        });

        const offsetX = GROUP_PADDING_LEFT - minX;
        const offsetY = GROUP_PADDING_TOP - minY;
        layoutedChildren.forEach((child) => {
          finalNodes.push({
            ...child,
            position: {
              x: child.position.x + offsetX,
              y: child.position.y + offsetY,
            },
          });
        });

        processedGroups.add(group.id);
      }
    }
  });

  if (isolatedTopLevel.length > 0) {
    finalNodes.push({
      id: 'isolated-section-header',
      type: 'sectionHeader',
      data: { label: 'Independent Milestones' },
      position: { x: 0, y: GRID_START_Y - 100 },
      draggable: false,
      selectable: false,
      style: { width: COLUMNS * COL_WIDTH, height: 60, pointerEvents: 'none' },
    });

    isolatedTopLevel.forEach((node, index) => {
      const col = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);

      node.position = {
        x: col * COL_WIDTH,
        y: GRID_START_Y + row * ROW_HEIGHT,
      };

      node.targetPosition = Position.Left;
      node.sourcePosition = Position.Right;

      finalNodes.push(node);
    });
  }

  return {
    nodes: finalNodes,
    edges,
    metadata: {
      effectiveViewMode: 'structure',
    },
  };
};

interface TopologyGraph {
  layers: string[][];
  layerById: Map<string, number>;
  inDegreeById: Map<string, number>;
  outDegreeById: Map<string, number>;
  hasCycle: boolean;
  criticalDepth: number;
}

const getTopologyGraph = (nodes: Node[], edges: Edge[]): TopologyGraph => {
  const milestoneNodes = nodes.filter((node) => node.type !== 'groupMilestone' && node.type !== 'sectionHeader');
  const groupNodes = nodes.filter((node) => node.type === 'groupMilestone');

  const milestoneIds = new Set(milestoneNodes.map((node) => node.id));
  const childrenByGroup = new Map<string, string[]>();
  milestoneNodes.forEach((node) => {
    if (node.parentNode) {
      if (!childrenByGroup.has(node.parentNode)) {
        childrenByGroup.set(node.parentNode, []);
      }
      childrenByGroup.get(node.parentNode)?.push(node.id);
    }
  });

  childrenByGroup.forEach((children) => children.sort());
  const groupIds = new Set(groupNodes.map((node) => node.id));

  const resolveRepresentative = (nodeId: string): string | null => {
    if (milestoneIds.has(nodeId)) {
      return nodeId;
    }
    if (groupIds.has(nodeId)) {
      const children = childrenByGroup.get(nodeId) || [];
      return children.length > 0 ? children[0] : null;
    }
    return null;
  };

  const adjacency = new Map<string, Set<string>>();
  const predecessors = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  milestoneNodes.forEach((node) => {
    adjacency.set(node.id, new Set());
    predecessors.set(node.id, new Set());
    inDegree.set(node.id, 0);
    outDegree.set(node.id, 0);
  });

  edges.forEach((edge) => {
    const source = resolveRepresentative(edge.source);
    const target = resolveRepresentative(edge.target);

    if (!source || !target || source === target) {
      return;
    }

    const targets = adjacency.get(source);
    if (!targets || targets.has(target)) {
      return;
    }

    targets.add(target);
    predecessors.get(target)?.add(source);
    inDegree.set(target, (inDegree.get(target) || 0) + 1);
    outDegree.set(source, (outDegree.get(source) || 0) + 1);
  });

  const inDegreeRemaining = new Map(inDegree);
  const layerById = new Map<string, number>();
  const orderInLayer = new Map<string, number>();
  const layers: string[][] = [];

  let current = Array.from(inDegreeRemaining.entries())
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b));

  let processedCount = 0;

  while (current.length > 0) {
    const layerIndex = layers.length;

    const sortedCurrent = [...current].sort((a, b) => {
      const predA = Array.from(predecessors.get(a) || []).filter((id) => orderInLayer.has(id));
      const predB = Array.from(predecessors.get(b) || []).filter((id) => orderInLayer.has(id));

      const baryA =
        predA.length > 0 ? predA.reduce((sum, id) => sum + (orderInLayer.get(id) || 0), 0) / predA.length : Number.POSITIVE_INFINITY;
      const baryB =
        predB.length > 0 ? predB.reduce((sum, id) => sum + (orderInLayer.get(id) || 0), 0) / predB.length : Number.POSITIVE_INFINITY;

      if (baryA !== baryB) {
        return baryA - baryB;
      }
      return a.localeCompare(b);
    });

    layers.push(sortedCurrent);
    sortedCurrent.forEach((nodeId, idx) => {
      layerById.set(nodeId, layerIndex);
      orderInLayer.set(nodeId, idx);
      processedCount += 1;
    });

    const next = new Set<string>();
    sortedCurrent.forEach((nodeId) => {
      (adjacency.get(nodeId) || new Set()).forEach((targetId) => {
        const nextDegree = (inDegreeRemaining.get(targetId) || 0) - 1;
        inDegreeRemaining.set(targetId, nextDegree);
        if (nextDegree === 0) {
          next.add(targetId);
        }
      });
    });

    current = Array.from(next).sort((a, b) => a.localeCompare(b));
  }

  const hasCycle = processedCount !== milestoneNodes.length;

  if (hasCycle) {
    const fallbackNodes = [...milestoneIds].sort((a, b) => a.localeCompare(b));
    fallbackNodes.forEach((nodeId, idx) => {
      layerById.set(nodeId, 0);
      orderInLayer.set(nodeId, idx);
    });
    return {
      layers: [fallbackNodes],
      layerById,
      inDegreeById: inDegree,
      outDegreeById: outDegree,
      hasCycle: true,
      criticalDepth: 0,
    };
  }

  const topoOrder = layers.flat();
  const dist = new Map<string, number>();
  topoOrder.forEach((nodeId) => dist.set(nodeId, 0));
  topoOrder.forEach((nodeId) => {
    const fromDist = dist.get(nodeId) || 0;
    (adjacency.get(nodeId) || new Set()).forEach((targetId) => {
      const currentDist = dist.get(targetId) || 0;
      if (fromDist + 1 > currentDist) {
        dist.set(targetId, fromDist + 1);
      }
    });
  });

  const criticalDepth = Math.max(0, ...Array.from(dist.values()));

  return {
    layers,
    layerById,
    inDegreeById: inDegree,
    outDegreeById: outDegree,
    hasCycle: false,
    criticalDepth,
  };
};

const getTopologyLayout = (nodes: Node[], edges: Edge[], direction: string): LayoutResult => {
  const topological = getTopologyGraph(nodes, edges);

  // Fallback to structure layout if cycle appears.
  if (topological.hasCycle) {
    const fallback = getChildModeLayout(nodes, edges, direction);
    return {
      ...fallback,
      metadata: {
        effectiveViewMode: 'structure',
        topology: {
          layerCount: topological.layers.length,
          criticalDepth: topological.criticalDepth,
          hasCycle: true,
        },
      },
    };
  }

  const groupNodes = nodes.filter((node) => node.type === 'groupMilestone');
  const milestoneNodes = nodes.filter((node) => node.type !== 'groupMilestone' && node.type !== 'sectionHeader');

  const milestoneById = new Map(milestoneNodes.map((node) => [node.id, node]));
  const childrenByGroup = new Map<string, Node[]>();

  milestoneNodes.forEach((node) => {
    if (node.parentNode) {
      if (!childrenByGroup.has(node.parentNode)) {
        childrenByGroup.set(node.parentNode, []);
      }
      childrenByGroup.get(node.parentNode)?.push(node);
    }
  });

  const positionedGlobal = new Map<string, { x: number; y: number }>();

  // Identify truly isolated nodes (no edges at all) for L0 separation
  const isolatedNodeIds = new Set<string>();
  milestoneNodes.forEach((node) => {
    const outDeg = topological.outDegreeById.get(node.id) || 0;
    const inDeg = topological.inDegreeById.get(node.id) || 0;
    if (outDeg === 0 && inDeg === 0) {
      isolatedNodeIds.add(node.id);
    }
  });

  topological.layers.forEach((layerIds, layerIdx) => {
    const x = layerIdx * TOPO_COL_WIDTH + 36;

    // L0: connected nodes on top, isolated (no edges) on bottom with a gap
    if (layerIdx === 0) {
      const connected: string[] = [];
      const isolated: string[] = [];
      layerIds.forEach((nodeId) => {
        if (!milestoneById.has(nodeId)) return;
        if (isolatedNodeIds.has(nodeId)) {
          isolated.push(nodeId);
        } else {
          connected.push(nodeId);
        }
      });

      const ISOLATION_GAP = Math.round(TOPO_ROW_HEIGHT * 0.7);

      connected.forEach((nodeId, rowIdx) => {
        positionedGlobal.set(nodeId, {
          x,
          y: TOPO_NODE_START_Y + rowIdx * TOPO_ROW_HEIGHT,
        });
      });

      const isolatedStartY = TOPO_NODE_START_Y
        + (connected.length > 0 ? connected.length * TOPO_ROW_HEIGHT + ISOLATION_GAP : 0);
      isolated.forEach((nodeId, rowIdx) => {
        positionedGlobal.set(nodeId, {
          x,
          y: isolatedStartY + rowIdx * TOPO_ROW_HEIGHT,
        });
      });

      return;
    }

    // Other layers: aligned rows, no jitter
    layerIds.forEach((nodeId, rowIdx) => {
      if (!milestoneById.has(nodeId)) return;

      positionedGlobal.set(nodeId, {
        x,
        y: TOPO_NODE_START_Y + rowIdx * TOPO_ROW_HEIGHT,
      });
    });
  });

  const finalNodes: Node[] = [];

  // Layer headers
  topological.layers.forEach((layerIds, layerIdx) => {
    const x = layerIdx * TOPO_COL_WIDTH + 26;
    finalNodes.push({
      id: `unlock-layer-header-${layerIdx}`,
      type: 'sectionHeader',
      data: {
        label: `Unlock L${layerIdx} (${layerIds.length})`,
        subtitle: 'Milestones that can be unlocked in parallel',
        compact: true,
      },
      position: { x, y: 0 },
      draggable: false,
      selectable: false,
      style: {
        width: DEFAULT_NODE_WIDTH + 20,
        height: TOPO_HEADER_HEIGHT,
        pointerEvents: 'none',
      },
    });
  });

  groupNodes.forEach((group) => {
    const children = childrenByGroup.get(group.id) || [];
    if (children.length === 0) return;

    const childrenPositions = children
      .map((child) => ({
        id: child.id,
        pos: positionedGlobal.get(child.id),
      }))
      .filter((item): item is { id: string; pos: { x: number; y: number } } => Boolean(item.pos));

    if (childrenPositions.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    childrenPositions.forEach(({ pos }) => {
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x + DEFAULT_NODE_WIDTH > maxX) maxX = pos.x + DEFAULT_NODE_WIDTH;
      if (pos.y + DEFAULT_NODE_HEIGHT > maxY) maxY = pos.y + DEFAULT_NODE_HEIGHT;
    });

    const groupX = minX - GROUP_PADDING_LEFT;
    const groupY = minY - GROUP_PADDING_TOP;
    const groupWidth = maxX - minX + GROUP_PADDING_LEFT + GROUP_PADDING_RIGHT;
    const groupHeight = maxY - minY + GROUP_PADDING_TOP + GROUP_PADDING_BOTTOM;

    finalNodes.push({
      ...group,
      position: { x: groupX, y: groupY },
      style: { width: groupWidth, height: groupHeight },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      data: {
        ...group.data,
        topoLayer: Math.min(
          ...children.map((child) => topological.layerById.get(child.id) ?? Number.MAX_SAFE_INTEGER)
        ),
      },
    });

    children.forEach((child) => {
      const globalPos = positionedGlobal.get(child.id);
      if (!globalPos) return;

      finalNodes.push({
        ...child,
        position: {
          x: globalPos.x - groupX,
          y: globalPos.y - groupY,
        },
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
        data: {
          ...child.data,
          topoLayer: topological.layerById.get(child.id),
          unlockBatch: topological.layerById.get(child.id),
          inDegree: topological.inDegreeById.get(child.id) || 0,
          outDegree: topological.outDegreeById.get(child.id) || 0,
          isIsolated: isolatedNodeIds.has(child.id),
        },
      });
    });
  });

  milestoneNodes
    .filter((node) => !node.parentNode)
    .forEach((node) => {
      const pos = positionedGlobal.get(node.id);
      if (!pos) return;

      finalNodes.push({
        ...node,
        position: pos,
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
        data: {
          ...node.data,
          topoLayer: topological.layerById.get(node.id),
          unlockBatch: topological.layerById.get(node.id),
          inDegree: topological.inDegreeById.get(node.id) || 0,
          outDegree: topological.outDegreeById.get(node.id) || 0,
          isIsolated: isolatedNodeIds.has(node.id),
        },
      });
    });

  return {
    nodes: finalNodes,
    edges,
    metadata: {
      effectiveViewMode: 'topology',
      topology: {
        layerCount: topological.layers.length,
        criticalDepth: topological.criticalDepth,
        hasCycle: false,
      },
    },
  };
};

export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = 'LR',
  groupMode = false,
  options: LayoutOptions = {}
): LayoutResult => {
  const viewMode = options.viewMode || 'structure';

  if (viewMode === 'topology') {
    return getTopologyLayout(nodes, edges, direction);
  }

  if (groupMode) {
    return getGroupModeLayout(nodes, edges, direction);
  }
  return getChildModeLayout(nodes, edges, direction);
};
