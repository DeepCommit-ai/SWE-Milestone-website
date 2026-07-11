import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ControlButton,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import { Plus, Minus, Home, Maximize2, Minimize2, Lock, Unlock } from 'lucide-react';
import 'reactflow/dist/style.css';
import './embed.css';
import MilestoneNode from './components/MilestoneNode';
import GroupMilestoneNode from './components/GroupMilestoneNode';
import SectionHeaderNode from './components/SectionHeaderNode';
import WideAdditionalEdge from './components/WideAdditionalEdge';
import DetailPanel from './components/DetailPanel';
import { getLayoutedElements, type ViewMode } from './utils/layout';
import { processGraphData } from './utils/csvParser';

const nodeTypes = {
  milestone: MilestoneNode,
  groupMilestone: GroupMilestoneNode,
  sectionHeader: SectionHeaderNode,
};
const edgeTypes = { wideAdditional: WideAdditionalEdge };

const HL = '#adbac7'; // highlight stroke for connected edges
const DIM_NODE = 0.14; // opacity of un-connected nodes when something is selected
const DIM_EDGE = 0.06; // opacity of un-connected edges when something is selected
const FIT = { padding: 0.12 };

interface DagData {
  milestones: string;
  dependencies: string;
  additional?: string;
  selectedIds?: string[];
  nonGradedIds?: string[];
  basePath?: string | null;
}

// Reproduces the relevant slice of the original App's layout pipeline:
// process → filter-to-selected (always on) → layout(viewMode) → flatten groups.
function buildGraph(d: DagData, viewMode: ViewMode) {
  const graph = processGraphData(d.milestones, d.dependencies, false, d.additional);
  let nodes: any[] = graph.nodes;
  let edges: any[] = graph.edges;

  const selectedIds = d.selectedIds;
  if (selectedIds && selectedIds.length > 0) {
    const sel = new Set(selectedIds);
    const groupsWithSel = new Set<string>();
    nodes.forEach((n) => {
      if (n.type === 'milestone' && sel.has(n.id) && n.parentNode) groupsWithSel.add(n.parentNode);
    });
    nodes = nodes.filter((n) => {
      if (n.type === 'groupMilestone') return groupsWithSel.has(n.id);
      if (n.type === 'milestone') return sel.has(n.id);
      return true;
    });
    const keep = new Set(nodes.map((n) => n.id));
    edges = edges.filter((e) => keep.has(e.source) && keep.has(e.target));

    const cnt = new Map<string, number>();
    nodes.forEach((n) => {
      if (n.type === 'milestone' && n.parentNode) cnt.set(n.parentNode, (cnt.get(n.parentNode) || 0) + 1);
    });
    const singles = new Set<string>();
    cnt.forEach((c, g) => { if (c === 1) singles.add(g); });
    if (singles.size) {
      nodes = nodes
        .filter((n) => !(n.type === 'groupMilestone' && singles.has(n.id)))
        .map((n) =>
          n.type === 'milestone' && n.parentNode && singles.has(n.parentNode)
            ? { ...n, parentNode: undefined, extent: undefined }
            : n
        );
    }
  }

  const nonGraded = new Set(d.nonGradedIds || []);
  nodes = nodes.map((n) =>
    n.type === 'milestone' && nonGraded.has(n.id)
      ? { ...n, data: { ...n.data, isNonGraded: true } }
      : n
  );

  const layout = getLayoutedElements(nodes, edges, 'LR', false, { viewMode, expandSubMilestones: true });
  let finalNodes: any[] = layout.nodes;

  const groupPos = new Map<string, { x: number; y: number }>();
  finalNodes.forEach((n) => { if (n.type === 'groupMilestone') groupPos.set(n.id, n.position); });
  finalNodes = finalNodes
    .filter((n) => n.type !== 'groupMilestone')
    .map((n) => {
      if (n.parentNode && groupPos.has(n.parentNode)) {
        const p = groupPos.get(n.parentNode)!;
        return {
          ...n,
          position: { x: n.position.x + p.x, y: n.position.y + p.y },
          parentNode: undefined,
          extent: undefined,
        };
      }
      return n;
    });

  return { nodes: finalNodes as Node[], edges: edges as Edge[] };
}

type Sel = { kind: 'node'; node: Node } | { kind: 'edge'; edge: Edge } | null;

// Neighbour highlight: keep set stays lit, everything else dims. Same idea as
// the original mstone page — click a milestone, its in/out edges + neighbours
// light up, the rest fade. Operates on the CURRENT nodes so a dragged position
// is preserved (only style/selected change, never position).
function litNodes(cur: Node[], keep: Set<string>, selId: string | null): Node[] {
  return cur.map((n) => ({
    ...n,
    selected: n.id === selId,
    style: {
      ...n.style,
      opacity: keep.has(n.id) ? 1 : DIM_NODE,
      transition: 'opacity .2s',
    },
  }));
}
// Lit edges also surface their weak/strong strength as a small label — but only
// the highlighted few, so the graph stays clean by default.
function litEdges(base: Edge[], hot: Set<string>): Edge[] {
  return base.map((e) =>
    hot.has(e.id)
      ? {
          ...e,
          label: (e.data as any)?.strength ? String((e.data as any).strength).toUpperCase() : '',
          labelStyle: { fill: '#cdd9e5', fontWeight: 700, fontSize: 10, letterSpacing: '0.04em' },
          labelBgStyle: { fill: '#12181e', fillOpacity: 0.95 },
          labelBgPadding: [5, 2] as [number, number],
          labelBgBorderRadius: 3,
          style: { ...e.style, stroke: HL, strokeWidth: 2.6, opacity: 1 },
          markerEnd: { ...(e.markerEnd as any), color: HL },
          zIndex: 20,
        }
      : { ...e, label: '', style: { ...e.style, opacity: DIM_EDGE }, zIndex: 1 }
  );
}

function Dag({ data }: { data: DagData }) {
  const [viewMode, setViewMode] = useState<ViewMode>('structure');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [sel, setSel] = useState<Sel>(null);
  const [isFs, setIsFs] = useState(false);
  const [isLocked, setIsLocked] = useState(false); // nodes draggable by default
  const baseRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });
  const rootRef = useRef<HTMLDivElement>(null);
  const rf = useReactFlow();

  const apply = useCallback((s: Sel) => {
    const be = baseRef.current.edges;
    if (!s) {
      setNodes((cur) => cur.map((n) => ({
        ...n,
        selected: false,
        style: { ...n.style, opacity: 1, transition: 'opacity .2s' },
      })));
      setEdges(be.map((e) => ({ ...e, label: '' })));
      return;
    }
    if (s.kind === 'node') {
      const id = s.node.id;
      const conn = be.filter((e) => e.source === id || e.target === id);
      const keep = new Set<string>([id]);
      conn.forEach((e) => { keep.add(e.source); keep.add(e.target); });
      setNodes((cur) => litNodes(cur, keep, id));
      setEdges(litEdges(be, new Set(conn.map((e) => e.id))));
    } else {
      const e0 = s.edge;
      setNodes((cur) => litNodes(cur, new Set<string>([e0.source, e0.target]), null));
      setEdges(litEdges(be, new Set<string>([e0.id])));
    }
  }, [setNodes, setEdges]);

  // (Re)build the base graph when data or view changes; clears any selection.
  useEffect(() => {
    const g = buildGraph(data, viewMode);
    baseRef.current = g;
    setSel(null);
    setNodes(g.nodes.map((n) => ({
      ...n,
      selected: false,
      style: { ...n.style, opacity: 1, transition: 'opacity .2s' },
    })));
    setEdges(g.edges);
  }, [data, viewMode, setNodes, setEdges]);

  // Track fullscreen and re-fit after the container resizes.
  useEffect(() => {
    const onFs = () => {
      setIsFs(Boolean(document.fullscreenElement));
      window.setTimeout(() => rf.fitView(FIT), 90);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [rf]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'groupMilestone' || node.type === 'sectionHeader') return;
    const s: Sel = { kind: 'node', node };
    setSel(s);
    apply(s);
  }, [apply]);
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    const s: Sel = { kind: 'edge', edge };
    setSel(s);
    apply(s);
  }, [apply]);
  const clear = useCallback(() => { setSel(null); apply(null); }, [apply]);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }, []);

  return (
    <div className={isFs ? 'mdag-root is-fs' : 'mdag-root'} ref={rootRef}>
      <div className="mdag-toggle" role="tablist" aria-label="DAG view">
        <button className={viewMode === 'structure' ? 'on' : ''} onClick={() => setViewMode('structure')}>
          Structure
        </button>
        <button className={viewMode === 'topology' ? 'on' : ''} onClick={() => setViewMode('topology')}>
          Unlock
        </button>
      </div>
      {Boolean(data.nonGradedIds?.length) && (
        <div
          className="mdag-status-key"
          title="Implemented by the agent but excluded from benchmark scoring"
        >
          <span aria-hidden="true" />
          <strong>{data.nonGradedIds!.length}</strong> non-graded
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={clear}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={!isLocked}
        fitView
        fitViewOptions={FIT}
        minZoom={0.05}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#39414d" variant={BackgroundVariant.Dots} gap={22} size={2} />
        <Controls showZoom={false} showFitView={false} showInteractive={false}>
          <ControlButton onClick={() => rf.zoomIn()} title="Zoom in"><Plus size={14} /></ControlButton>
          <ControlButton onClick={() => rf.zoomOut()} title="Zoom out"><Minus size={14} /></ControlButton>
          <ControlButton onClick={() => rf.fitView(FIT)} title="Reset layout"><Home size={14} /></ControlButton>
          <ControlButton
            onClick={() => setIsLocked((v) => !v)}
            title={isLocked ? 'Unlock nodes (allow dragging)' : 'Lock nodes (disable dragging)'}
          >
            {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
          </ControlButton>
          <ControlButton onClick={toggleFullscreen} title={isFs ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFs ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </ControlButton>
        </Controls>
      </ReactFlow>
      <DetailPanel
        selectedNode={sel?.kind === 'node' ? (sel.node as Node<any>) : null}
        selectedEdge={sel?.kind === 'edge' ? sel.edge : null}
        onClose={clear}
        allNodes={baseRef.current.nodes as Node<any>[]}
        basePath={data.basePath ?? null}
      />
    </div>
  );
}

(window as any).MstoneDAG = {
  mount(el: HTMLElement, data: DagData) {
    const root = createRoot(el);
    root.render(
      <ReactFlowProvider>
        <Dag data={data} />
      </ReactFlowProvider>
    );
    return { unmount: () => root.unmount() };
  },
};
