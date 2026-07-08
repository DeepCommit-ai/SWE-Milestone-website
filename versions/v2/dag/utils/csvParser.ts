import { Edge, MarkerType, Node } from 'reactflow';
import { Category, DependencyData, MilestoneData } from '../types';

// Simple CSV parser that handles quoted strings
function parseCSV(text: string): Record<string, string>[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const lines = trimmed.split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());

  const result: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row: Record<string, string> = {};
    let currentVal = '';
    let inQuotes = false;
    let colIndex = 0;

    for (let charIndex = 0; charIndex < line.length; charIndex++) {
      const char = line[charIndex];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        if (colIndex < headers.length) {
          row[headers[colIndex]] = currentVal;
        }
        currentVal = '';
        colIndex++;
      } else {
        currentVal += char;
      }
    }

    if (colIndex < headers.length) {
      row[headers[colIndex]] = currentVal;
    }

    result.push(row);
  }
  return result;
}

const mapCategory = (cat: string): Category => {
  const lower = cat.toLowerCase();
  if (lower.includes('security')) return Category.SECURITY_FIX;
  if (lower.includes('feature')) return Category.MAJOR_FEATURE;
  if (lower.includes('breaking')) return Category.BREAKING_CHANGE;
  if (lower.includes('maintenance')) return Category.MAINTENANCE;
  if (lower.includes('platform')) return Category.PLATFORM_SUPPORT;
  if (lower.includes('architect')) return Category.ARCHITECTURAL_REFACTOR;
  return Category.MAINTENANCE;
};

const normalizeDependencyType = (value: string | undefined): DependencyData['semanticType'] => {
  const upper = (value || 'FUNC').trim().toUpperCase();
  if (upper === 'ARCH' || upper === 'NFR' || upper === 'TEXT') return upper;
  return 'FUNC';
};

const normalizeStrength = (value: string | undefined): DependencyData['strength'] => {
  return (value || '').trim().toLowerCase() === 'strong' ? 'strong' : 'weak';
};

// Formats 2023-02-15T16:51... to 02/15/23
const formatDate = (dateStr: string) => {
  if (!dateStr || dateStr.trim() === '') return '';
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
    }).format(date);
  } catch {
    return dateStr;
  }
};

const parseList = (str: string) => (str ? str.split(';').filter((s) => s.trim().length > 0) : []);

const normalizeIntegrationTestCommit = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

interface EdgeVisual {
  stroke: string;
  width: number;
  opacity: number;
  dash?: string;
  markerColor: string;
  labelColor: string;
  labelBg: string;
  showLabel: boolean;
}

const getEdgeVisual = (_isAdditional: boolean, _strength: DependencyData['strength']): EdgeVisual => {
  // One faint, uniform line for every dependency — no amber/extra vs normal,
  // no strong/weak distinction. Click-highlighting (embed.tsx) is what surfaces
  // a node's connections; edge type/strength still show in the detail panel.
  const c = '#5b636e';
  return {
    stroke: c,
    width: 1.8,
    opacity: 0.5,
    markerColor: c,
    labelColor: '#98a5b3',
    labelBg: '#1a1f26',
    showLabel: false,
  };
};

const applyVisual = (edge: Edge, visual: EdgeVisual, labelText: string) => {
  edge.style = {
    stroke: visual.stroke,
    strokeWidth: visual.width,
    opacity: visual.opacity,
    ...(visual.dash ? { strokeDasharray: visual.dash } : {}),
  };
  edge.markerEnd = {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
    color: visual.markerColor,
  };
  edge.labelStyle = { fill: visual.labelColor, fontWeight: 700, fontSize: 12 };
  edge.labelBgStyle = { fill: visual.labelBg, fillOpacity: 0.88, rx: 4, ry: 4 };
  edge.label = visual.showLabel ? labelText : '';
  edge.type = 'default';
};

export const processGraphData = (
  milestonesCsv: string,
  dependenciesCsv: string,
  liftExternalEdges = true,
  additionalDependenciesCsv?: string
) => {
  const milestoneRows = parseCSV(milestonesCsv);
  const dependencyRows = parseCSV(dependenciesCsv);
  const additionalDependencyRows = additionalDependenciesCsv ? parseCSV(additionalDependenciesCsv) : [];

  const nodes: Node[] = [];

  // Map to track parentage for edge lifting
  const nodeParentMap = new Map<string, string>();
  const childrenMap = new Map<string, Node[]>();

  // Pre-scan: count potential children per parent to handle single-child groups
  // Sub-milestone formats supported:
  //   - New: M{n}_sub-{01-99} (e.g., M3_sub-01, M3_sub-02)
  //   - Legacy: M{n}.{seq} (e.g., M3.1, M3.2)
  const parentChildCount = new Map<string, number>();
  milestoneRows.forEach((row) => {
    const id = row.id;
    if (!id) return;
    const subIndex = id.indexOf('_sub-');
    const dotIndex = subIndex === -1 ? id.lastIndexOf('.') : -1;
    const separatorIndex = subIndex !== -1 ? subIndex : dotIndex;
    if (separatorIndex !== -1) {
      const parentId = id.substring(0, separatorIndex);
      parentChildCount.set(parentId, (parentChildCount.get(parentId) || 0) + 1);
    }
  });

  // 1. Process milestones
  milestoneRows.forEach((row) => {
    const id = row.id;
    if (!id) return;

    const integrationTestCommit = normalizeIntegrationTestCommit(row.integration_test_commit);
    const data: MilestoneData = {
      id,
      label: row.title || row.id,
      category: mapCategory(row.category || ''),
      commits: row.commits ? row.commits.split(';').length : 0,
      srcLoc: parseInt(row.src_loc, 10) || 0,
      startDate: formatDate(row.start_time),
      endDate: formatDate(row.end_time),
      description: row.rationale || row.title || '',
      miniSrs: row.mini_srs || row.rationale || 'No details available.',
      additions: parseInt(row.additions, 10) || 0,
      deletions: parseInt(row.deletions, 10) || 0,
      srcAdditions: parseInt(row.src_additions, 10) || 0,
      srcDeletions: parseInt(row.src_deletions, 10) || 0,
      touchedSrcFiles: parseList(row.touched_src_files),
      touchedTestFiles: parseList(row.touched_test_files),
      commitHashes: parseList(row.commits),
      integrationTestCommit,
    };

    const node: Node = {
      id,
      type: 'milestone',
      data,
      position: { x: 0, y: 0 },
    };

    // Hierarchy detection: M{n}_sub-{01-99} or M{n}.{seq} -> parent: M{n}
    const subIndex = id.indexOf('_sub-');
    const dotIndex = subIndex === -1 ? id.lastIndexOf('.') : -1;
    const separatorIndex = subIndex !== -1 ? subIndex : dotIndex;
    if (separatorIndex !== -1) {
      const parentId = id.substring(0, separatorIndex);
      const childCount = parentChildCount.get(parentId) || 0;

      if (childCount > 1) {
        node.parentNode = parentId;
        node.extent = 'parent';
        nodeParentMap.set(id, parentId);

        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId)?.push(node);
      } else {
        nodes.push(node);
        nodeParentMap.set(id, id);
      }
    } else {
      nodes.push(node);
      nodeParentMap.set(id, id);
    }
  });

  // 2. Create missing parent groups
  childrenMap.forEach((children, parentId) => {
    let parentNode = nodes.find((n) => n.id === parentId);

    const childIntegrationTestCommit = children
      .map((child) => normalizeIntegrationTestCommit((child.data as MilestoneData).integrationTestCommit))
      .find(Boolean);

    if (!parentNode) {
      parentNode = {
        id: parentId,
        type: 'groupMilestone',
        data: {
          id: parentId,
          label: `${parentId} (Group)`,
          category: Category.MAJOR_FEATURE,
          commits: 0,
          srcLoc: 0,
          startDate: '',
          endDate: '',
          description: 'Group Container',
          miniSrs: 'Container for sub-milestones',
          additions: 0,
          deletions: 0,
          srcAdditions: 0,
          srcDeletions: 0,
          touchedSrcFiles: [],
          touchedTestFiles: [],
          commitHashes: [],
          integrationTestCommit: childIntegrationTestCommit,
        },
        position: { x: 0, y: 0 },
        style: { width: 0, height: 0 },
      };
      nodes.push(parentNode);
      nodeParentMap.set(parentId, parentId);
    } else {
      parentNode.type = 'groupMilestone';
      parentNode.style = { width: 0, height: 0 };
      const parentData = parentNode.data as MilestoneData;
      const parentIntegrationTestCommit = normalizeIntegrationTestCommit(parentData.integrationTestCommit);
      const resolvedIntegrationTestCommit = parentIntegrationTestCommit || childIntegrationTestCommit;
      if (resolvedIntegrationTestCommit) {
        parentNode.data = { ...parentData, integrationTestCommit: resolvedIntegrationTestCommit };
      }
    }

    children.forEach((child) => {
      nodes.push(child);
    });
  });

  // 3. Process edges
  const edgeMap = new Map<string, Edge>();

  dependencyRows.forEach((row) => {
    // Accept both the current CSV column names (prerequisite_id/dependant_id)
    // and the legacy ones (source_id/target_id), so the DAG renders whether or
    // not the server rewrites the header.
    const sourceId = row.prerequisite_id || row.source_id;
    const targetId = row.dependant_id || row.target_id;
    if (!sourceId || !targetId) return;

    const sourceParent = nodeParentMap.get(sourceId) || sourceId;
    const targetParent = nodeParentMap.get(targetId) || targetId;

    let finalSource = sourceId;
    let finalTarget = targetId;

    const isCrossGroup = sourceParent !== targetParent;
    if (liftExternalEdges && isCrossGroup) {
      finalSource = sourceParent;
      finalTarget = targetParent;
    }

    if (finalSource === finalTarget) return;

    const edgeKey = `${finalSource}-${finalTarget}`;
    const semanticType = normalizeDependencyType(row.type);
    const strength = normalizeStrength(row.strength);
    const labelText = `${semanticType}/${strength}`;

    if (edgeMap.has(edgeKey)) {
      const existing = edgeMap.get(edgeKey)!;
      const existingStrength = ((existing.data as DependencyData).strength || 'weak') as DependencyData['strength'];
      const resolvedStrength = existingStrength === 'strong' || strength === 'strong' ? 'strong' : 'weak';
      const isAdditional = Boolean((existing.data as DependencyData).isAdditional);

      existing.data = {
        ...(existing.data as DependencyData),
        type: semanticType,
        semanticType,
        strength: resolvedStrength,
        edgeClass: resolvedStrength,
      };

      const nextLabelText = isAdditional ? `⚡ ${semanticType}/${resolvedStrength}` : `${semanticType}/${resolvedStrength}`;
      const visual = getEdgeVisual(isAdditional, resolvedStrength);
      applyVisual(existing, visual, nextLabelText);

      const data = existing.data as DependencyData;
      if (row.rationale) {
        const currentRat = data.rationale || '';
        if (!currentRat.includes(row.rationale)) {
          data.rationale = currentRat ? `${currentRat}\n• ${row.rationale}` : `• ${row.rationale}`;
        }
      }
      data.label = nextLabelText;
      data.labelVisible = visual.showLabel;
    } else {
      const edge: Edge = {
        id: `e-${finalSource}-${finalTarget}`,
        source: finalSource,
        target: finalTarget,
        type: 'default',
        data: {
          type: semanticType,
          semanticType,
          strength,
          edgeClass: strength,
          rationale: row.rationale ? `• ${row.rationale}` : '',
          label: labelText,
          labelVisible: false,
        } satisfies DependencyData,
        zIndex: 10,
      };

      const visual = getEdgeVisual(false, strength);
      applyVisual(edge, visual, labelText);
      (edge.data as DependencyData).labelVisible = visual.showLabel;
      edgeMap.set(edgeKey, edge);
    }
  });

  // 4. Process additional dependencies
  const additionalEdgeIds = new Set<string>();

  additionalDependencyRows.forEach((row) => {
    // Accept both the current CSV column names (prerequisite_id/dependant_id)
    // and the legacy ones (source_id/target_id), so the DAG renders whether or
    // not the server rewrites the header.
    const sourceId = row.prerequisite_id || row.source_id;
    const targetId = row.dependant_id || row.target_id;
    if (!sourceId || !targetId) return;

    const sourceParent = nodeParentMap.get(sourceId) || sourceId;
    const targetParent = nodeParentMap.get(targetId) || targetId;

    let finalSource = sourceId;
    let finalTarget = targetId;

    const isCrossGroup = sourceParent !== targetParent;
    if (liftExternalEdges && isCrossGroup) {
      finalSource = sourceParent;
      finalTarget = targetParent;
    }

    if (finalSource === finalTarget) return;

    const edgeKey = `${finalSource}-${finalTarget}`;
    const semanticType = normalizeDependencyType(row.type);
    const strength = normalizeStrength(row.strength);

    additionalEdgeIds.add(edgeKey);

    if (edgeMap.has(edgeKey)) {
      const existing = edgeMap.get(edgeKey)!;
      const existingStrength = ((existing.data as DependencyData).strength || 'weak') as DependencyData['strength'];
      const resolvedStrength = existingStrength === 'strong' || strength === 'strong' ? 'strong' : 'weak';
      const labelText = `⚡ ${semanticType}/${resolvedStrength}`;

      existing.data = {
        ...(existing.data as DependencyData),
        type: semanticType,
        semanticType,
        strength: resolvedStrength,
        edgeClass: resolvedStrength,
        isAdditional: true,
        label: labelText,
      };

      const visual = getEdgeVisual(true, resolvedStrength);
      applyVisual(existing, visual, labelText);
      (existing.data as DependencyData).labelVisible = visual.showLabel;

      if (row.rationale) {
        const data = existing.data as DependencyData;
        const currentRat = data.rationale || '';
        if (!currentRat.includes(row.rationale)) {
          data.rationale = currentRat ? `${currentRat}\n• ${row.rationale}` : `• ${row.rationale}`;
        }
      }
      existing.zIndex = 15;
    } else {
      const labelText = `⚡ ${semanticType}/${strength}`;
      const edge: Edge = {
        id: `e-${finalSource}-${finalTarget}`,
        source: finalSource,
        target: finalTarget,
        type: 'default',
        data: {
          type: semanticType,
          semanticType,
          strength,
          edgeClass: strength,
          rationale: row.rationale ? `• ${row.rationale}` : '',
          isAdditional: true,
          label: labelText,
          labelVisible: false,
        } satisfies DependencyData,
        zIndex: 15,
      };
      const visual = getEdgeVisual(true, strength);
      applyVisual(edge, visual, labelText);
      (edge.data as DependencyData).labelVisible = visual.showLabel;
      edgeMap.set(edgeKey, edge);
    }
  });

  return { nodes, edges: Array.from(edgeMap.values()), additionalEdgeIds };
};
