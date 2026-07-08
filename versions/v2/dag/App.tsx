
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ReactFlowProvider,
  BackgroundVariant,
} from 'reactflow';
import { Network, GitMerge, Download, Database, RefreshCw, Layers, LayoutGrid, Folder, Eye, EyeOff, Filter, FilterX, BarChart3, Zap, ZapOff } from 'lucide-react';

import MilestoneNode from './components/MilestoneNode';
import GroupMilestoneNode from './components/GroupMilestoneNode';
import SectionHeaderNode from './components/SectionHeaderNode';
import WideAdditionalEdge from './components/WideAdditionalEdge';
import DetailPanel from './components/DetailPanel';
import { getLayoutedElements, ViewMode } from './utils/layout';
import { processGraphData } from './utils/csvParser';
import { MilestoneData } from './types';

interface DatasetVariant {
  id: string;
  name: string;
  basePath: string;
  mtime?: number; // modification time
}

interface DatasetGroup {
  id: string;
  name: string;
  variants: DatasetVariant[];
}

interface DatasetRoot {
  id: string;
  name: string;
  path?: string;
}

const nodeTypes = {
  milestone: MilestoneNode,
  groupMilestone: GroupMilestoneNode,
  sectionHeader: SectionHeaderNode,
};

const edgeTypes = {
  wideAdditional: WideAdditionalEdge,
};

type EdgeVisualMode = 'base' | 'highlight' | 'dim';

const resolveEdgeVisual = (edge: Edge, mode: EdgeVisualMode) => {
  const edgeClass = edge.data?.edgeClass === 'strong' ? 'strong' : 'weak';
  const isAdditional = Boolean(edge.data?.isAdditional);
  const isTopology = Boolean(edge.data?.isTopologyView);
  const layerDiff: number = typeof edge.data?.layerDiff === 'number' ? edge.data.layerDiff : 0;

  // ── Additional edges ──
  if (isAdditional) {
    if (mode === 'highlight') {
      return {
        style: { stroke: '#b45309', strokeWidth: edgeClass === 'strong' ? 4.2 : 3.4, strokeDasharray: '8 4', opacity: 1 },
        labelStyle: { fill: '#78350f', fontWeight: 700, fontSize: 12, opacity: 1 },
        labelBgStyle: { fill: '#fde68a', fillOpacity: 1, rx: 4, ry: 4, opacity: 1 },
        markerColor: '#b45309',
        showLabel: true,
      };
    }
    if (mode === 'dim') {
      // Topology weak additional: keep stable so clicking doesn't change them
      if (isTopology && edgeClass === 'weak') {
        return {
          style: { stroke: '#fcd34d', strokeWidth: 1.4, strokeDasharray: '6 4', opacity: 0.7 },
          labelStyle: { fill: '#b45309', fontWeight: 700, fontSize: 12, opacity: 0.7 },
          labelBgStyle: { fill: '#fefce8', fillOpacity: 0.7, rx: 4, ry: 4, opacity: 0.7 },
          markerColor: '#fcd34d',
          showLabel: false,
        };
      }
      return {
        style: { stroke: '#fcd34d', strokeWidth: edgeClass === 'strong' ? 2.2 : 1.6, strokeDasharray: '8 4', opacity: 0.25 },
        labelStyle: { fill: '#b45309', fontWeight: 700, fontSize: 12, opacity: 0.4 },
        labelBgStyle: { fill: '#fefce8', fillOpacity: 0.7, rx: 4, ry: 4, opacity: 0.4 },
        markerColor: '#fcd34d',
        showLabel: false,
      };
    }
    // base mode — topology weak additional: subdued
    if (isTopology && edgeClass === 'weak') {
      return {
        style: { stroke: '#fcd34d', strokeWidth: 1.4, strokeDasharray: '6 4', opacity: 0.7 },
        labelStyle: { fill: '#b45309', fontWeight: 700, fontSize: 12, opacity: 0.7 },
        labelBgStyle: { fill: '#fefce8', fillOpacity: 0.7, rx: 4, ry: 4, opacity: 0.7 },
        markerColor: '#fcd34d',
        showLabel: false,
      };
    }
    return {
      style: {
        stroke: edgeClass === 'strong' ? '#d97706' : '#f59e0b',
        strokeWidth: edgeClass === 'strong' ? 3.2 : 2.2,
        strokeDasharray: '8 4',
        opacity: edgeClass === 'strong' ? 1 : 0.68,
      },
      labelStyle: { fill: '#92400e', fontWeight: 700, fontSize: 12, opacity: 1 },
      labelBgStyle: { fill: '#fef3c7', fillOpacity: 0.9, rx: 4, ry: 4, opacity: 1 },
      markerColor: edgeClass === 'strong' ? '#d97706' : '#f59e0b',
      showLabel: edgeClass === 'strong',
    };
  }

  // ── Normal edges ──
  if (mode === 'highlight') {
    return {
      style: {
        stroke: '#2563eb',
        strokeWidth: edgeClass === 'strong' ? 3.8 : 3,
        opacity: 1,
      },
      labelStyle: { fill: '#1e3a8a', fontWeight: 700, fontSize: 12, opacity: 1 },
      labelBgStyle: { fill: '#dbeafe', fillOpacity: 1, rx: 4, ry: 4, opacity: 1 },
      markerColor: '#2563eb',
      showLabel: true,
    };
  }
  if (mode === 'dim') {
    // Topology weak normal: keep stable so clicking doesn't change them
    if (isTopology && edgeClass === 'weak') {
      return {
        style: { stroke: '#94a3b8', strokeWidth: 1.2, opacity: 0.7 },
        labelStyle: { fill: '#94a3b8', fontWeight: 700, fontSize: 12, opacity: 0.7 },
        labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.7, rx: 4, ry: 4, opacity: 0.7 },
        markerColor: '#cbd5e1',
        showLabel: false,
      };
    }
    return {
      style: {
        stroke: '#cbd5e1',
        strokeWidth: edgeClass === 'strong' ? 2 : 1.8,
        opacity: edgeClass === 'strong' ? 0.35 : 0.32,
      },
      labelStyle: { fill: '#94a3b8', fontWeight: 700, fontSize: 12, opacity: 0.45 },
      labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.8, rx: 4, ry: 4, opacity: 0.45 },
      markerColor: '#cbd5e1',
      showLabel: false,
    };
  }

  // base mode — topology: weak edges subdued, strong edges by layer distance
  if (isTopology) {
    if (edgeClass === 'weak') {
      return {
        style: { stroke: '#94a3b8', strokeWidth: 1.2, opacity: 0.7 },
        labelStyle: { fill: '#94a3b8', fontWeight: 700, fontSize: 12, opacity: 0.7 },
        labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.7, rx: 4, ry: 4, opacity: 0.7 },
        markerColor: '#cbd5e1',
        showLabel: false,
      };
    }
    // Strong edges: prominent for adjacent, progressively fainter for cross-layer
    if (layerDiff <= 1) {
      return {
        style: { stroke: '#334155', strokeWidth: 2.8, opacity: 0.92 },
        labelStyle: { fill: '#1e293b', fontWeight: 700, fontSize: 12, opacity: 1 },
        labelBgStyle: { fill: '#f1f5f9', fillOpacity: 0.9, rx: 4, ry: 4, opacity: 1 },
        markerColor: '#334155',
        showLabel: true,
      };
    }
    if (layerDiff === 2) {
      return {
        style: { stroke: '#64748b', strokeWidth: 2, opacity: 0.6 },
        labelStyle: { fill: '#475569', fontWeight: 700, fontSize: 12, opacity: 0.7 },
        labelBgStyle: { fill: '#f1f5f9', fillOpacity: 0.8, rx: 4, ry: 4, opacity: 0.7 },
        markerColor: '#64748b',
        showLabel: false,
      };
    }
    // layerDiff >= 3: thin, muted
    return {
      style: { stroke: '#94a3b8', strokeWidth: 1.4, opacity: 0.45 },
      labelStyle: { fill: '#94a3b8', fontWeight: 700, fontSize: 12, opacity: 0.5 },
      labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.7, rx: 4, ry: 4, opacity: 0.5 },
      markerColor: '#94a3b8',
      showLabel: false,
    };
  }

  // Structure mode base
  return {
    style: {
      stroke: edgeClass === 'strong' ? '#475569' : '#94a3b8',
      strokeWidth: edgeClass === 'strong' ? 2.8 : 2,
      opacity: edgeClass === 'strong' ? 0.95 : 0.82,
    },
    labelStyle: { fill: '#475569', fontWeight: 700, fontSize: 12, opacity: 1 },
    labelBgStyle: { fill: '#f1f5f9', fillOpacity: 0.85, rx: 4, ry: 4, opacity: 1 },
    markerColor: edgeClass === 'strong' ? '#475569' : '#94a3b8',
    showLabel: edgeClass === 'strong',
  };
};

type SelectionTarget = 
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string; source: string; target: string };

// LocalStorage keys
const STORAGE_KEY_GROUP = 'mstone_dag_selected_group';
const STORAGE_KEY_VARIANT = 'mstone_dag_selected_variant';
const STORAGE_KEY_ROOT = 'mstone_dag_selected_root';
const STORAGE_KEY_CUSTOM_PATHS = 'mstone_dag_custom_paths'; // stringified {id, name, path}[]

const DEFAULT_ROOTS: DatasetRoot[] = [
  { id: 'evoclaw-data', name: 'evoclaw-data' },
  { id: 'result', name: 'result' },
  { id: 'harness_workspace', name: 'harness_workspace' },
];

interface CustomPath {
  id: string;  // prefixed with "custom:"
  name: string;
  path: string;
}

function loadCustomPaths(): CustomPath[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_PATHS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomPaths(paths: CustomPath[]) {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_PATHS, JSON.stringify(paths));
  } catch {}
}

function MilestoneGraph() {
  // React Flow State
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // App State
  const [initialized, setInitialized] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('structure');
  const [isEdgeLiftingEnabled, setIsEdgeLiftingEnabled] = useState(false);
  const [isGroupAlignMode, setIsGroupAlignMode] = useState(false); // true = align by group, false = align by children
  const [isGroupVisible, setIsGroupVisible] = useState(false); // toggle group box visibility
  const [topologyStats, setTopologyStats] = useState({
    layerCount: 0,
    criticalDepth: 0,
    hasCycle: false,
    effectiveViewMode: 'structure' as ViewMode,
  });

  // Selected milestone IDs filter (from selected_milestone_ids.txt)
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<string[] | null>(null);
  const [isFilterBySelectedEnabled, setIsFilterBySelectedEnabled] = useState(false);

  // Additional dependencies
  const [hasAdditionalDeps, setHasAdditionalDeps] = useState(false);
  const [isAdditionalDepsEnabled, setIsAdditionalDepsEnabled] = useState(true);

  // Two-level selection: group (repo+version) -> variant (experiment suffix)
  // Initialize from localStorage
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_GROUP);
    } catch {
      return null;
    }
  });
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_VARIANT);
    } catch {
      return null;
    }
  });

  const [selectedRootId, setSelectedRootId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_ROOT) || DEFAULT_ROOTS[0].id;
    } catch {
      return DEFAULT_ROOTS[0].id;
    }
  });

  const [customPaths, setCustomPaths] = useState<CustomPath[]>(loadCustomPaths);
  const [availableRoots, setAvailableRoots] = useState<DatasetRoot[]>(() => {
    const cps = loadCustomPaths();
    return [...DEFAULT_ROOTS, ...cps.map(cp => ({ id: cp.id, name: cp.name }))];
  });

  // Datasets State (loaded from API)
  const [groups, setGroups] = useState<DatasetGroup[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(true);
  const [datasetsError, setDatasetsError] = useState<string | null>(null);

  // Data State
  const [rawCsvData, setRawCsvData] = useState<{ milestones: string, dependencies: string, additionalDependencies?: string } | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Selection State
  const [selectedNode, setSelectedNode] = React.useState<Node<MilestoneData> | null>(null);
  const [selectedEdge, setSelectedEdge] = React.useState<Edge | null>(null);

  // Derived state
  const currentGroup = useMemo(() =>
    groups.find(g => g.id === selectedGroupId) || groups[0],
  [selectedGroupId, groups]);

  const currentVariant = useMemo(() => {
    if (!currentGroup) return null;
    return currentGroup.variants.find(v => v.id === selectedVariantId) || currentGroup.variants[0];
  }, [currentGroup, selectedVariantId]);

  const currentRoot = useMemo(() =>
    availableRoots.find(root => root.id === selectedRootId) || null,
  [availableRoots, selectedRootId]);

  // Custom path handlers
  const addCustomPath = useCallback(() => {
    const input = window.prompt('Enter absolute path to data directory (e.g. /path/to/harness_trial_space):');
    if (!input) return;
    const path = input.trim();
    if (!path) return;
    const name = window.prompt('Name for this source (shown in dropdown):', path.split('/').pop() || 'custom') || path;
    const id = 'custom_' + btoa(path).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
    if (customPaths.some(cp => cp.path === path)) {
      alert('Path already added');
      return;
    }
    const next = [...customPaths, { id, name, path }];
    setCustomPaths(next);
    saveCustomPaths(next);
    setAvailableRoots(prev => [...prev.filter(r => r.id !== id), { id, name }]);
    setSelectedRootId(id);
  }, [customPaths]);

  const editCurrentCustomPath = useCallback(() => {
    const cp = customPaths.find(c => c.id === selectedRootId);
    if (!cp) return;
    const newPath = window.prompt('Edit absolute path:', cp.path);
    if (newPath == null) return;
    const trimmedPath = newPath.trim();
    if (!trimmedPath) return;
    const newName = window.prompt('Edit display name:', cp.name);
    if (newName == null) return;
    const trimmedName = newName.trim() || trimmedPath;
    // Regenerate id if path changed (for backend cache key)
    const newId = trimmedPath === cp.path
      ? cp.id
      : 'custom_' + btoa(trimmedPath).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
    const next = customPaths.map(c =>
      c.id === cp.id ? { id: newId, name: trimmedName, path: trimmedPath } : c
    );
    setCustomPaths(next);
    saveCustomPaths(next);
    setAvailableRoots(prev => prev.map(r =>
      r.id === cp.id ? { id: newId, name: trimmedName } : r
    ));
    if (cp.id !== newId) setSelectedRootId(newId);
    // Trigger reload of datasets
    setDatasetsError(null);
  }, [customPaths, selectedRootId]);

  const removeCurrentCustomPath = useCallback(() => {
    const cp = customPaths.find(c => c.id === selectedRootId);
    if (!cp) return;
    if (!window.confirm(`Remove "${cp.name}" (${cp.path}) ?`)) return;
    const next = customPaths.filter(c => c.id !== cp.id);
    setCustomPaths(next);
    saveCustomPaths(next);
    setAvailableRoots(prev => prev.filter(r => r.id !== cp.id));
    setSelectedRootId(DEFAULT_ROOTS[0].id);
  }, [customPaths, selectedRootId]);

  const isCustomRootSelected = customPaths.some(cp => cp.id === selectedRootId);
  const [showManageModal, setShowManageModal] = useState(false);

  const editCustomPathById = useCallback((id: string) => {
    const cp = customPaths.find(c => c.id === id);
    if (!cp) return;
    const newPath = window.prompt('Edit absolute path:', cp.path);
    if (newPath == null) return;
    const trimmedPath = newPath.trim();
    if (!trimmedPath) return;
    const newName = window.prompt('Edit display name:', cp.name);
    if (newName == null) return;
    const trimmedName = newName.trim() || trimmedPath;
    const newId = trimmedPath === cp.path
      ? cp.id
      : 'custom_' + btoa(trimmedPath).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
    const next = customPaths.map(c =>
      c.id === cp.id ? { id: newId, name: trimmedName, path: trimmedPath } : c
    );
    setCustomPaths(next);
    saveCustomPaths(next);
    setAvailableRoots(prev => prev.map(r =>
      r.id === cp.id ? { id: newId, name: trimmedName, path: trimmedPath } : r
    ));
    if (selectedRootId === cp.id && cp.id !== newId) setSelectedRootId(newId);
    setDatasetsError(null);
  }, [customPaths, selectedRootId]);

  const removeCustomPathById = useCallback((id: string) => {
    const cp = customPaths.find(c => c.id === id);
    if (!cp) return;
    if (!window.confirm(`Remove "${cp.name}" (${cp.path}) ?`)) return;
    const next = customPaths.filter(c => c.id !== cp.id);
    setCustomPaths(next);
    saveCustomPaths(next);
    setAvailableRoots(prev => prev.filter(r => r.id !== cp.id));
    if (selectedRootId === cp.id) setSelectedRootId(DEFAULT_ROOTS[0].id);
  }, [customPaths, selectedRootId]);

  // Calculate statistics for displayed milestones
  const milestoneStats = useMemo(() => {
    // Get all milestone nodes (not groups)
    const milestoneNodes = nodes.filter(n => n.type === 'milestone');
    if (milestoneNodes.length === 0) {
      return { count: 0, totalSrcLoc: 0, avgSrcLoc: 0, cvSrcLoc: 0 };
    }

    // Extract srcLoc values
    const srcLocValues = milestoneNodes.map(n => (n.data as MilestoneData)?.srcLoc || 0);
    const count = srcLocValues.length;
    const totalSrcLoc = srcLocValues.reduce((sum, val) => sum + val, 0);
    const avgSrcLoc = totalSrcLoc / count;

    // Calculate standard deviation
    const squaredDiffs = srcLocValues.map(val => Math.pow(val - avgSrcLoc, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / count;
    const stdDev = Math.sqrt(variance);

    // CV = stdDev / mean (coefficient of variation)
    const cvSrcLoc = avgSrcLoc > 0 ? stdDev / avgSrcLoc : 0;

    return { count, totalSrcLoc, avgSrcLoc, cvSrcLoc };
  }, [nodes]);

  // Load datasets from API
  const fetchDatasets = useCallback(async () => {
    setDatasetsLoading(true);
    setDatasetsError(null);
    try {
      // If selected root is a custom path, pass it via `path` query + keep the same id
      const customMatch = customPaths.find(cp => cp.id === selectedRootId);
      const url = customMatch
        ? `/api/mstone/datasets?path=${encodeURIComponent(customMatch.path)}&id=${encodeURIComponent(customMatch.id)}`
        : `/api/mstone/datasets?root=${encodeURIComponent(selectedRootId)}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load datasets: ${response.status}`);
      }
      const data = await response.json();
      if (data.status === 'success' && data.groups) {
        if (Array.isArray(data.sources) && data.sources.length > 0) {
          // Merge backend roots with frontend custom paths (preserve path info)
          const serverRoots = data.sources.filter((r: DatasetRoot) => !r.id.startsWith('custom_'));
          const customRoots = customPaths.map(cp => ({ id: cp.id, name: cp.name, path: cp.path }));
          setAvailableRoots([...serverRoots, ...customRoots]);
        }
        setGroups(data.groups);

        if (data.groups.length > 0) {
          // Check if saved group still exists
          const savedGroupExists = selectedGroupId && data.groups.some((g: DatasetGroup) => g.id === selectedGroupId);

          if (savedGroupExists) {
            // Verify variant exists in the saved group
            const savedGroup = data.groups.find((g: DatasetGroup) => g.id === selectedGroupId);
            const savedVariantExists = selectedVariantId && savedGroup?.variants.some((v: DatasetVariant) => v.id === selectedVariantId);

            if (!savedVariantExists && savedGroup?.variants.length > 0) {
              setSelectedVariantId(savedGroup.variants[0].id);
            }
          } else {
            // Fallback to first group and variant
            setSelectedGroupId(data.groups[0].id);
            if (data.groups[0].variants.length > 0) {
              setSelectedVariantId(data.groups[0].variants[0].id);
            }
          }
        }
      } else {
        throw new Error(data.error || 'Unknown error loading datasets');
      }
    } catch (err) {
      console.error('Error loading datasets:', err);
      setDatasetsError(err instanceof Error ? err.message : 'Failed to load datasets');
    } finally {
      setDatasetsLoading(false);
    }
  }, [selectedGroupId, selectedVariantId, selectedRootId, customPaths]);

  // Load datasets on mount
  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  // Track previous group to detect group changes
  const prevGroupIdRef = useRef<string | null>(null);

  // When group changes, auto-select variant with latest modification time
  useEffect(() => {
    if (currentGroup && currentGroup.variants.length > 0) {
      const groupChanged = prevGroupIdRef.current !== currentGroup.id;
      prevGroupIdRef.current = currentGroup.id;

      // Always select newest variant when group changes
      if (groupChanged) {
        // Sort by mtime descending (most recently modified first)
        const sortedVariants = [...currentGroup.variants].sort((a, b) =>
          (b.mtime || 0) - (a.mtime || 0)
        );
        setSelectedVariantId(sortedVariants[0].id);
      }
    }
  }, [currentGroup]);

  // Save selection to localStorage
  useEffect(() => {
    try {
      if (selectedGroupId) {
        localStorage.setItem(STORAGE_KEY_GROUP, selectedGroupId);
      }
    } catch {}
  }, [selectedGroupId]);

  useEffect(() => {
    try {
      if (selectedVariantId) {
        localStorage.setItem(STORAGE_KEY_VARIANT, selectedVariantId);
      }
    } catch {}
  }, [selectedVariantId]);

  useEffect(() => {
    try {
      if (selectedRootId) {
        localStorage.setItem(STORAGE_KEY_ROOT, selectedRootId);
      }
    } catch {}
  }, [selectedRootId]);

  // Load CSV Data
  useEffect(() => {
    if (!currentVariant) return;

    async function fetchCsvData() {
      setIsLoading(true);
      setLoadingError(null);
      setInitialized(false);
      setSelectedNode(null);
      setSelectedEdge(null);
      setSelectedMilestoneIds(null);
      setIsFilterBySelectedEnabled(false);
      setTopologyStats({
        layerCount: 0,
        criticalDepth: 0,
        hasCycle: false,
        effectiveViewMode: 'structure',
      });

      const milestonesUrl = `${currentVariant.basePath}/milestones.csv`;
      const dependenciesUrl = `${currentVariant.basePath}/dependencies.csv`;
      const additionalDepsUrl = `${currentVariant.basePath}/additional_dependencies.csv`;
      const selectedIdsUrl = `/api/mstone/selected-ids?basePath=${encodeURIComponent(currentVariant.basePath)}`;

      try {
        const [mRes, dRes, additionalRes, selectedRes] = await Promise.all([
          fetch(milestonesUrl),
          fetch(dependenciesUrl),
          fetch(additionalDepsUrl),
          fetch(selectedIdsUrl)
        ]);

        if (!mRes.ok) throw new Error(`Failed to load milestones.csv (${mRes.status})`);
        if (!dRes.ok) throw new Error(`Failed to load dependencies.csv (${dRes.status})`);

        const milestonesText = await mRes.text();
        const dependenciesText = await dRes.text();

        // Check for additional dependencies (optional)
        let additionalDepsText: string | undefined;
        if (additionalRes.ok) {
          additionalDepsText = await additionalRes.text();
          setHasAdditionalDeps(true);
        } else {
          setHasAdditionalDeps(false);
        }

        // Check for selected milestone IDs
        if (selectedRes.ok) {
          const selectedData = await selectedRes.json();
          if (selectedData.exists && selectedData.ids) {
            setSelectedMilestoneIds(selectedData.ids);
            setIsFilterBySelectedEnabled(true);
          }
        }

        setRawCsvData({ milestones: milestonesText, dependencies: dependenciesText, additionalDependencies: additionalDepsText });
      } catch (err) {
        console.error("Error loading CSV data:", err);
        setLoadingError(err instanceof Error ? err.message : "Unknown loading error");
        setRawCsvData(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCsvData();
  }, [currentVariant]);

  // Process and Layout Graph
  useEffect(() => {
    if (!rawCsvData) return;

    const graphData = processGraphData(
      rawCsvData.milestones,
      rawCsvData.dependencies,
      isEdgeLiftingEnabled,
      isAdditionalDepsEnabled ? rawCsvData.additionalDependencies : undefined
    );

    let nodesToLayout = graphData.nodes;
    let edgesToLayout = graphData.edges;

    // Apply selected milestone filter BEFORE layout so nodes are re-ordered
    if (isFilterBySelectedEnabled && selectedMilestoneIds && selectedMilestoneIds.length > 0) {
      const selectedSet = new Set(selectedMilestoneIds);

      // Find which groups have selected children
      const groupsWithSelectedChildren = new Set<string>();
      nodesToLayout.forEach((node) => {
        if (node.type === 'milestone' && selectedSet.has(node.id) && node.parentNode) {
          groupsWithSelectedChildren.add(node.parentNode);
        }
      });

      // Filter nodes: keep selected milestones and their parent groups
      nodesToLayout = nodesToLayout.filter((node) => {
        if (node.type === 'groupMilestone') {
          return groupsWithSelectedChildren.has(node.id);
        }
        if (node.type === 'milestone') {
          return selectedSet.has(node.id);
        }
        return true; // Keep other node types
      });

      // Filter edges: keep only edges between remaining nodes
      const remainingNodeIds = new Set(nodesToLayout.map(n => n.id));
      edgesToLayout = edgesToLayout.filter((edge) =>
        remainingNodeIds.has(edge.source) && remainingNodeIds.has(edge.target)
      );

      // Handle single-child groups after filtering: treat them as independent milestones
      const groupChildCount = new Map<string, number>();
      nodesToLayout.forEach((node) => {
        if (node.type === 'milestone' && node.parentNode) {
          groupChildCount.set(node.parentNode, (groupChildCount.get(node.parentNode) || 0) + 1);
        }
      });

      // Find groups with only one child
      const singleChildGroups = new Set<string>();
      groupChildCount.forEach((count, groupId) => {
        if (count === 1) {
          singleChildGroups.add(groupId);
        }
      });

      if (singleChildGroups.size > 0) {
        // Remove single-child groups and convert their children to independent milestones
        nodesToLayout = nodesToLayout
          .filter((node) => !(node.type === 'groupMilestone' && singleChildGroups.has(node.id)))
          .map((node) => {
            if (node.type === 'milestone' && node.parentNode && singleChildGroups.has(node.parentNode)) {
              // Convert to independent milestone
              return {
                ...node,
                parentNode: undefined,
                extent: undefined,
              };
            }
            return node;
          });
      }
    }

    // Topology mode should consider all visible dependencies, including extra deps.
    const layoutEdges = edgesToLayout;

    // Now do the layout on the (potentially filtered) nodes
    const layoutData = getLayoutedElements(nodesToLayout, layoutEdges, 'LR', isGroupAlignMode, {
      viewMode,
      expandSubMilestones: true,
    });

    let finalNodes = layoutData.nodes;
    let finalEdges = edgesToLayout;

    setTopologyStats({
      layerCount: layoutData.metadata.topology?.layerCount || 0,
      criticalDepth: layoutData.metadata.topology?.criticalDepth || 0,
      hasCycle: layoutData.metadata.topology?.hasCycle || false,
      effectiveViewMode: layoutData.metadata.effectiveViewMode,
    });

    // Apply group visibility: when hidden, remove groups and flatten children to absolute positions
    if (!isGroupVisible) {
      // Build a map of group positions for converting child relative positions to absolute
      const groupPositions = new Map<string, { x: number; y: number }>();
      finalNodes.forEach((node) => {
        if (node.type === 'groupMilestone') {
          groupPositions.set(node.id, node.position);
        }
      });

      // Filter out groups and convert children to absolute positions
      finalNodes = finalNodes
        .filter((node) => node.type !== 'groupMilestone')
        .map((node) => {
          if (node.parentNode && groupPositions.has(node.parentNode)) {
            const parentPos = groupPositions.get(node.parentNode)!;
            return {
              ...node,
              position: {
                x: node.position.x + parentPos.x,
                y: node.position.y + parentPos.y,
              },
              parentNode: undefined,
              extent: undefined,
            };
          }
          return node;
        });
    }

    const topologyActive = viewMode === 'topology' && layoutData.metadata.effectiveViewMode === 'topology';

    if (topologyActive) {
      const nodeById = new Map(finalNodes.map((node) => [node.id, node]));

      const getNodeCenter = (nodeId: string) => {
        const node = nodeById.get(nodeId);
        if (!node) return null;

        const width = node.style?.width && typeof node.style.width === 'number' ? node.style.width : 405;
        const height = node.style?.height && typeof node.style.height === 'number' ? node.style.height : 130;
        return {
          x: node.position.x + width / 2,
          y: node.position.y + height / 2,
        };
      };

      const getNodeLayer = (nodeId: string) => {
        const node = nodeById.get(nodeId);
        const raw = (node?.data as MilestoneData | undefined)?.topoLayer;
        return typeof raw === 'number' ? raw : null;
      };

      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      finalNodes.forEach((node) => {
        if (node.type === 'sectionHeader') return;
        const height = node.style?.height && typeof node.style.height === 'number' ? node.style.height : 130;
        minY = Math.min(minY, node.position.y);
        maxY = Math.max(maxY, node.position.y + height);
      });

      if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
        minY = 0;
        maxY = 800;
      }

      let topLane = 0;
      let bottomLane = 0;
      const laneGap = 60;

      // Assign topology metadata + edge types based on layer distance for ALL edges
      finalEdges = finalEdges.map((edge, idx) => {
        const sourceLayer = getNodeLayer(edge.source);
        const targetLayer = getNodeLayer(edge.target);
        const layerDiff =
          sourceLayer !== null && targetLayer !== null ? Math.abs(targetLayer - sourceLayer) : 1;

        const isAdditional = Boolean(edge.data?.isAdditional);
        const topoData = { ...edge.data, layerDiff, isTopologyView: true };

        // Arc routing for long-range edges
        const edgeClass = edge.data?.edgeClass === 'strong' ? 'strong' : 'weak';
        const needsArc = isAdditional
          ? layerDiff >= 2
          : (edgeClass === 'strong' && layerDiff >= 3);

        if (needsArc) {
          const sourceCenter = getNodeCenter(edge.source);
          const targetCenter = getNodeCenter(edge.target);
          if (sourceCenter && targetCenter) {
            const localMinY = Math.min(sourceCenter.y, targetCenter.y);
            const localMaxY = Math.max(sourceCenter.y, targetCenter.y);
            const invert = sourceCenter.y > targetCenter.y;
            const preferTop = (idx + (invert ? 1 : 0)) % 2 === 0;

            // Additional edges: wider arcs; strong normal edges: tighter arcs
            const baseArcOffset = isAdditional
              ? 100 + layerDiff * 30
              : 60 + layerDiff * 20;
            const lane = preferTop ? topLane++ : bottomLane++;
            const routeY = preferTop
              ? localMinY - baseArcOffset - lane * laneGap
              : localMaxY + baseArcOffset + lane * laneGap;

            return {
              ...edge,
              type: 'wideAdditional',
              data: { ...topoData, extraRouteY: routeY },
              label: '',
              zIndex: isAdditional ? 30 + lane : 25 + lane,
            };
          }
        }

        // Everything else: default bezier
        return {
          ...edge,
          type: 'default',
          data: topoData,
          zIndex: isAdditional ? 20 : 5,
        };
      });
    } else {
      finalEdges = finalEdges.map((edge) => {
        if (!edge.data?.isAdditional) {
          return edge;
        }
        return {
          ...edge,
          type: 'default',
          data: { ...edge.data, extraRouteY: undefined },
        };
      });
    }

    // Apply base visual styles so edges render correctly before any interaction
    finalEdges = finalEdges.map((edge) => {
      const baseOpts = resolveEdgeVisual(edge, 'base');
      const labelText = (edge.data?.label as string | undefined) || edge.label || '';
      return {
        ...edge,
        style: baseOpts.style,
        labelStyle: baseOpts.labelStyle,
        labelBgStyle: baseOpts.labelBgStyle,
        markerEnd: edge.markerEnd
          ? { ...(edge.markerEnd as any), color: baseOpts.markerColor }
          : undefined,
        label: baseOpts.showLabel ? labelText : '',
      };
    });

    setNodes(finalNodes);
    setEdges(finalEdges);
    setInitialized(true);
  }, [
    rawCsvData,
    isEdgeLiftingEnabled,
    isGroupAlignMode,
    isGroupVisible,
    isFilterBySelectedEnabled,
    isAdditionalDepsEnabled,
    selectedMilestoneIds,
    viewMode,
    setNodes,
    setEdges,
  ]);

  // Actions
  const downloadGraph = useCallback(() => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ nodes, edges }, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${selectedVariantId || 'dag'}_dag.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }, [nodes, edges, selectedVariantId]);

  const highlightGraph = useCallback((target: SelectionTarget | null) => {
    const relevantNodeIds = new Set<string>();
    const relevantEdgeIds = new Set<string>();

    if (target) {
      if (target.type === 'node') {
        relevantNodeIds.add(target.id);

        // Check if target is a group node - find all children
        const childNodeIds = new Set<string>();
        nodes.forEach((node) => {
          if (node.parentNode === target.id) {
            childNodeIds.add(node.id);
            relevantNodeIds.add(node.id);
          }
        });

        const isGroupNode = childNodeIds.size > 0;

        edges.forEach((edge) => {
          if (isGroupNode) {
            // For group nodes: only highlight internal edges (between children)
            if (childNodeIds.has(edge.source) && childNodeIds.has(edge.target)) {
              relevantEdgeIds.add(edge.id);
            }
          } else {
            // For regular nodes: highlight all connected edges
            if (edge.source === target.id) {
              relevantNodeIds.add(edge.target);
              relevantEdgeIds.add(edge.id);
            }
            if (edge.target === target.id) {
              relevantNodeIds.add(edge.source);
              relevantEdgeIds.add(edge.id);
            }
          }
        });
      } else if (target.type === 'edge') {
        relevantEdgeIds.add(target.id);
        relevantNodeIds.add(target.source);
        relevantNodeIds.add(target.target);
      }
    }

    setNodes((nds) =>
      nds.map((node) => {
        if (!target) {
          return { ...node, style: { ...node.style, opacity: 1 } };
        }
        const isRelevant = relevantNodeIds.has(node.id) || (node.parentNode && relevantNodeIds.has(node.parentNode));
        return {
          ...node,
          style: {
            ...node.style,
            opacity: isRelevant ? 1 : 0.25,
            transition: 'opacity 0.2s ease-in-out',
          },
        };
      })
    );

    setEdges((eds) =>
      eds.map((edge) => {
        const labelText = (edge.data?.label as string | undefined) || edge.label || '';

        if (!target) {
          const baseOpts = resolveEdgeVisual(edge, 'base');
          const baseZIndex = edge.data?.isTopologyView
            ? (edge.data?.isAdditional ? 20 : 5)
            : (edge.data?.isAdditional ? 15 : 0);
          return {
            ...edge,
            style: baseOpts.style,
            labelStyle: baseOpts.labelStyle,
            labelBgStyle: baseOpts.labelBgStyle,
            markerEnd: { ...(edge.markerEnd as any), color: baseOpts.markerColor },
            label: baseOpts.showLabel ? labelText : '',
            animated: false,
            zIndex: baseZIndex,
          };
        }

        const isRelevant = relevantEdgeIds.has(edge.id);

        if (isRelevant) {
          const highlightOpts = resolveEdgeVisual(edge, 'highlight');
          return {
            ...edge,
            style: highlightOpts.style,
            labelStyle: highlightOpts.labelStyle,
            labelBgStyle: highlightOpts.labelBgStyle,
            markerEnd: { ...(edge.markerEnd as any), color: highlightOpts.markerColor },
            label: labelText,
            animated: true,
            zIndex: edge.data?.isAdditional ? 15 : 10,
          };
        } else {
          const dimOpts = resolveEdgeVisual(edge, 'dim');
          return {
            ...edge,
            style: dimOpts.style,
            labelStyle: dimOpts.labelStyle,
            labelBgStyle: dimOpts.labelBgStyle,
            markerEnd: { ...(edge.markerEnd as any), color: dimOpts.markerColor },
            label: '',
            animated: false,
            zIndex: 0,
          };
        }
      })
    );
  }, [edges, nodes, setEdges, setNodes]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node as Node<MilestoneData>);
    setSelectedEdge(null);
    highlightGraph({ type: 'node', id: node.id });
  }, [highlightGraph]);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    highlightGraph({ type: 'edge', id: edge.id, source: edge.source, target: edge.target });
  }, [highlightGraph]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
    highlightGraph(null);
  }, [highlightGraph]);

  const closePanel = () => {
    setSelectedNode(null);
    setSelectedEdge(null);
    highlightGraph(null);
  };

  // Datasets loading state
  if (datasetsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-500 gap-4">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
        <span className="font-medium">Loading available datasets...</span>
      </div>
    );
  }

  // Datasets error state
  if (datasetsError) {
    const currentCustom = customPaths.find(cp => cp.id === selectedRootId);
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-red-600 gap-4">
        <div className="flex flex-col items-center gap-2">
          <span className="font-bold text-lg">Error loading datasets</span>
          <span className="text-sm bg-red-50 p-2 rounded border border-red-200 font-mono">{datasetsError}</span>
          {currentCustom && (
            <span className="text-xs text-slate-500 font-mono">Path: {currentCustom.path}</span>
          )}
        </div>
        <div className="flex gap-2 items-center flex-wrap justify-center">
          <label className="text-sm font-medium text-slate-700">Data Root:</label>
          <select
            value={selectedRootId}
            onChange={(e) => setSelectedRootId(e.target.value)}
            className="pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {availableRoots.map(root => (
              <option key={root.id} value={root.id}>{root.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowManageModal(true)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 shadow-sm"
            title="Manage data source paths"
          >
            ⚙ Manage
          </button>
        </div>
        <button
          onClick={fetchDatasets}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    );
  }

  // No datasets available
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-600 gap-4">
        <Database size={48} className="text-slate-400" />
        <span className="font-bold text-lg">No datasets available</span>
        <span className="text-sm text-slate-500">
          No directories with milestones.csv and dependencies.csv found in DATA/{currentRoot?.name || selectedRootId}
        </span>
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium text-slate-700">Data Root:</label>
          <select
            value={selectedRootId}
            onChange={(e) => setSelectedRootId(e.target.value)}
            className="pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {availableRoots.map(root => (
              <option key={root.id} value={root.id}>{root.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchDatasets}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
    );
  }

  // Error State Render
  if (loadingError) {
      return (
          <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-red-600 gap-4">
              <div className="flex flex-col items-center gap-2">
                <span className="font-bold text-lg">Error loading data</span>
                <span className="text-sm bg-red-50 p-2 rounded border border-red-200 font-mono">{loadingError}</span>
              </div>
              <div className="flex gap-2 items-center mt-4">
                  <label className="text-sm font-medium text-slate-700">Data Root:</label>
                  <select
                    value={selectedRootId}
                    onChange={(e) => setSelectedRootId(e.target.value)}
                    className="pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {availableRoots.map(root => (
                      <option key={root.id} value={root.id}>{root.name}</option>
                    ))}
                  </select>
                  <label className="text-sm font-medium text-slate-700">Select Dataset:</label>
                  <select
                    value={selectedGroupId || ''}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
              </div>
          </div>
      );
  }

  // Main Render
  return (
    <div className="w-full h-screen bg-slate-50 relative overflow-hidden">
      {/* Top Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200 pointer-events-none">
        {/* Row 1: Title + Dataset Selectors */}
        <div className="px-4 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-extrabold text-slate-800 tracking-tight whitespace-nowrap flex items-center gap-2">
              Milestone DAG
              {isLoading && <span className="text-xs font-normal text-blue-500 animate-pulse">(Loading...)</span>}
            </h1>
            <div className="text-xs text-slate-400 truncate hidden sm:flex flex-col leading-tight">
              <span>
                {currentGroup?.name || 'Select a dataset'}
                {currentVariant && currentGroup?.variants.length > 1 && ` · ${currentVariant.name}`}
              </span>
              {currentRoot?.path && (
                <span className="font-mono text-slate-400/80 text-[10px]" title={currentRoot.path}>
                  {currentRoot.path}
                </span>
              )}
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2 flex-shrink-0">
            {/* Data Root Selector */}
            <div className="relative flex items-center">
              <Folder size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <select
                value={selectedRootId}
                onChange={(e) => setSelectedRootId(e.target.value)}
                disabled={datasetsLoading}
                className="pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-slate-50 disabled:opacity-50"
                style={{ width: 'auto', minWidth: 'fit-content' }}
                title={currentRoot?.path ? `Path: ${currentRoot.path}` : 'Select Data Root'}
              >
                {availableRoots.map(root => (
                  <option key={root.id} value={root.id} title={root.path || ''}>
                    {root.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Manage paths button — opens modal with list/add/edit/remove */}
            <button
              onClick={() => setShowManageModal(true)}
              disabled={datasetsLoading}
              className="px-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 shadow-sm disabled:opacity-50"
              title="Manage data source paths"
            >
              ⚙ Manage
            </button>

            {/* Group Selector */}
            <div className="relative flex items-center">
              <Database size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <select
                value={selectedGroupId || ''}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                disabled={isLoading}
                className="pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-slate-50 disabled:opacity-50"
                style={{ width: 'auto', minWidth: 'fit-content' }}
                title="Select Repository"
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Variant Selector */}
            {currentGroup && currentGroup.variants.length > 0 && (
              <select
                value={selectedVariantId || ''}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                disabled={isLoading}
                className="px-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-slate-50 disabled:opacity-50"
                style={{ width: 'auto', minWidth: 'fit-content' }}
                title="Select Experiment Variant"
              >
                {currentGroup.variants.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            )}

            {/* Refresh */}
            <button
              onClick={fetchDatasets}
              disabled={datasetsLoading}
              className="p-1.5 bg-white border border-slate-300 text-slate-500 rounded-md hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50"
              title="Refresh dataset list"
            >
              <RefreshCw size={14} className={datasetsLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Row 2: View Controls — wraps on narrow screens */}
        <div className="px-4 pb-2 pointer-events-auto flex items-center gap-1.5 flex-wrap">
          {/* View Mode */}
          <button
            onClick={() => setViewMode('structure')}
            className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-md text-xs font-medium shadow-sm transition-all ${
              viewMode === 'structure'
                ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Structure layout view"
          >
            <LayoutGrid size={13} />
            <span>Structure</span>
          </button>

          <button
            onClick={() => setViewMode('topology')}
            className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-md text-xs font-medium shadow-sm transition-all ${
              viewMode === 'topology'
                ? 'bg-indigo-500 border-indigo-500 text-white hover:bg-indigo-600'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Unlock order topology view"
          >
            <Layers size={13} />
            <span>Unlock</span>
          </button>

          {/* Divider */}
          <div className="h-4 w-px bg-slate-200 mx-0.5"></div>

          {/* Edge Mode */}
          <button
            onClick={() => setIsEdgeLiftingEnabled(!isEdgeLiftingEnabled)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-md text-xs font-medium hover:bg-slate-50 shadow-sm transition-all"
            title={isEdgeLiftingEnabled ? "Show direct connections between nodes" : "Lift edges to group level"}
          >
            {isEdgeLiftingEnabled ? <Network size={13} /> : <GitMerge size={13} />}
            <span>{isEdgeLiftingEnabled ? "Lifted" : "Direct"}</span>
          </button>

          {/* Layout Mode */}
          <button
            onClick={() => setIsGroupAlignMode(!isGroupAlignMode)}
            disabled={viewMode === 'topology'}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-md text-xs font-medium hover:bg-slate-50 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              viewMode === 'topology'
                ? 'Topology mode uses unlock layers'
                : isGroupAlignMode
                  ? 'Align by child nodes'
                  : 'Align by group boxes'
            }
          >
            {isGroupAlignMode ? <Layers size={13} /> : <LayoutGrid size={13} />}
            <span>{isGroupAlignMode ? "Group" : "Child"}</span>
          </button>

          {/* Group Visibility */}
          <button
            onClick={() => setIsGroupVisible(!isGroupVisible)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-md text-xs font-medium hover:bg-slate-50 shadow-sm transition-all"
            title={isGroupVisible ? "Hide group boxes" : "Show group boxes"}
          >
            {isGroupVisible ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>{isGroupVisible ? "Groups" : "Flat"}</span>
          </button>

          {/* Divider */}
          <div className="h-4 w-px bg-slate-200 mx-0.5"></div>

          {/* Selected Milestones Filter */}
          {selectedMilestoneIds && selectedMilestoneIds.length > 0 && (
            <button
              onClick={() => setIsFilterBySelectedEnabled(!isFilterBySelectedEnabled)}
              className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-md text-xs font-medium shadow-sm transition-all ${
                isFilterBySelectedEnabled
                  ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title={isFilterBySelectedEnabled ? `Showing ${selectedMilestoneIds.length} selected milestones` : `Filter to ${selectedMilestoneIds.length} selected milestones`}
            >
              {isFilterBySelectedEnabled ? <FilterX size={13} /> : <Filter size={13} />}
              <span>{isFilterBySelectedEnabled ? `Selected (${selectedMilestoneIds.length})` : 'Filter'}</span>
            </button>
          )}

          {/* Additional Dependencies Toggle */}
          {hasAdditionalDeps && (
            <button
              onClick={() => setIsAdditionalDepsEnabled(!isAdditionalDepsEnabled)}
              className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-md text-xs font-medium shadow-sm transition-all ${
                isAdditionalDepsEnabled
                  ? 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600'
                  : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
              }`}
              title={isAdditionalDepsEnabled ? 'Hide additional dependency edges' : 'Show additional dependency edges'}
            >
              {isAdditionalDepsEnabled ? <Zap size={13} /> : <ZapOff size={13} />}
              <span>Extra Deps</span>
            </button>
          )}

          {viewMode === 'topology' && topologyStats.hasCycle && (
            <div className="px-2.5 py-1 rounded-md border border-amber-200 bg-amber-50 text-amber-700 text-xs font-medium">
              Cycle detected, fallback to Structure layout
            </div>
          )}

          {/* Spacer pushes export to the right */}
          <div className="flex-1"></div>

          {/* Export */}
          <button
            onClick={downloadGraph}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 border border-slate-800 text-white rounded-md text-xs font-medium hover:bg-slate-700 shadow-sm transition-all"
          >
            <Download size={13} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Statistics Panel - Top Left */}
      {initialized && milestoneStats.count > 0 && (
        <div className="absolute top-24 left-4 z-10 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg shadow-lg p-3 pointer-events-auto">
          <div className="flex items-center gap-2 mb-2 text-slate-700 font-semibold text-sm">
            <BarChart3 size={16} className="text-blue-500" />
            <span>Statistics</span>
            <span className="text-slate-400 font-normal">({milestoneStats.count} milestones)</span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Total Src LoC:</span>
              <span className="font-mono font-medium text-slate-800">{milestoneStats.totalSrcLoc.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Avg Src LoC:</span>
              <span className="font-mono font-medium text-slate-800">{Math.round(milestoneStats.avgSrcLoc).toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Src LoC CV:</span>
              <span className="font-mono font-medium text-slate-800">{milestoneStats.cvSrcLoc.toFixed(3)}</span>
            </div>
            {viewMode === 'topology' && topologyStats.effectiveViewMode === 'topology' && (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Layers:</span>
                  <span className="font-mono font-medium text-slate-800">{topologyStats.layerCount}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Critical Depth:</span>
                  <span className="font-mono font-medium text-slate-800">{topologyStats.criticalDepth}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Loading State or Graph */}
      {(!initialized && !loadingError) ? (
         <div className="flex flex-col items-center justify-center h-full bg-slate-50 text-slate-500 gap-4">
            <div className="w-8 h-8 border-4 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
            <span className="font-medium">Loading {currentGroup?.name || 'dataset'}...</span>
         </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.05}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          className="bg-slate-50"
          attributionPosition="bottom-left"
        >
          <Background color="#94a3b8" variant={BackgroundVariant.Dots} gap={24} size={2} />
          <Controls className="!bg-white !border-gray-200 !shadow-lg !m-4" />
        </ReactFlow>
      )}

      {/* Side Detail Panel */}
      <DetailPanel
        selectedNode={selectedNode}
        selectedEdge={selectedEdge}
        onClose={closePanel}
        allNodes={nodes}
        basePath={currentVariant?.basePath ?? null}
      />

      {/* Manage Paths Modal */}
      {showManageModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
          onClick={() => setShowManageModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl w-[680px] max-w-[90vw] max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="font-bold text-base text-slate-800">Manage Data Source Paths</h3>
                <p className="text-xs text-slate-500">Built-in roots are defined server-side. Custom paths are saved in your browser.</p>
              </div>
              <button
                onClick={() => setShowManageModal(false)}
                className="p-1 hover:bg-slate-200 rounded text-slate-500"
              >
                ✕
              </button>
            </div>
            {/* Body: list of paths */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {availableRoots.length === 0 && (
                <div className="text-center text-slate-400 text-sm py-8">No data roots configured.</div>
              )}
              {availableRoots.map((root) => {
                const isSelected = root.id === selectedRootId;
                const isCustom = root.id.startsWith('custom_');
                return (
                  <div
                    key={root.id}
                    className={`flex items-center gap-3 p-3 rounded-md border ${
                      isSelected ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-800">{root.name}</span>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                            ACTIVE
                          </span>
                        )}
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          isCustom ? 'text-purple-700 bg-purple-100' : 'text-slate-600 bg-slate-200'
                        }`}>
                          {isCustom ? 'CUSTOM' : 'BUILT-IN'}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-slate-500 truncate mt-1" title={root.path || ''}>
                        {root.path || '(path unknown)'}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {!isSelected && (
                        <button
                          onClick={() => { setSelectedRootId(root.id); setShowManageModal(false); }}
                          className="px-2.5 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                        >
                          Select
                        </button>
                      )}
                      {isCustom && (
                        <>
                          <button
                            onClick={() => editCustomPathById(root.id)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-100"
                            title="Edit path or name"
                          >
                            ✎ Edit
                          </button>
                          <button
                            onClick={() => removeCustomPathById(root.id)}
                            className="px-2.5 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50"
                            title="Remove this custom path"
                          >
                            × Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50">
              <button
                onClick={addCustomPath}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-500 rounded hover:bg-blue-600"
              >
                + Add Custom Path
              </button>
              <button
                onClick={() => setShowManageModal(false)}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <MilestoneGraph />
    </ReactFlowProvider>
  );
}
