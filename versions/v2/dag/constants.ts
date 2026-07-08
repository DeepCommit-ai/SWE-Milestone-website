

import { Node, Edge, MarkerType } from 'reactflow';
import { Category } from './types';

// Helper to create consistent nodes
const createNode = (id: string, data: any) => ({
  id,
  type: 'milestone',
  data: { ...data, id },
  position: { x: 0, y: 0 },
});

// Helper for sub-nodes
const createSubNode = (id: string, parentId: string, position: {x: number, y: number}, data: any) => ({
  id,
  type: 'milestone', // Sub-nodes use the standard card look
  data: { ...data, id },
  position,
  parentNode: parentId, // Use parentNode for nesting
  extent: 'parent', // Constrain to parent bounds
});

export const INITIAL_NODES: Node[] = [
  createNode('M007', {
    label: 'Proxy Verification State Tracking for HTTPS',
    category: Category.SECURITY_FIX,
    commits: 3,
    srcLoc: 44,
    startDate: '11/21/23',
    endDate: '01/17/24',
    description: 'Implement proper tracking and validation of proxy verification states for HTTPS connections.',
    touchedFiles: ['src/urllib3/connection.py', 'src/urllib3/connectionpool.py'],
    commitHashes: ['3ca46ea', 'bbba487', 'e29f504']
  }),
  createNode('M004', {
    label: 'HTTP/2 Protocol Implementation',
    category: Category.ARCHITECTURAL_REFACTOR,
    commits: 11,
    srcLoc: 937,
    startDate: '01/22/24',
    endDate: '10/02/24',
    description: 'Full implementation of the HTTP/2 protocol stack including header compression and multiplexing.',
    touchedFiles: ['src/http2/framing.py', 'src/http2/stream.py'],
    commitHashes: ['a1b2c3d', 'e5f6g7h']
  }),
  createNode('M011', {
    label: 'Add JavaScript Promise Integration for Emscripten',
    category: Category.PLATFORM_SUPPORT,
    commits: 4,
    srcLoc: 1431,
    startDate: '11/25/23',
    endDate: '11/05/24',
    description: 'Enables async/await patterns when compiling to WebAssembly via Emscripten.',
    touchedFiles: ['src/emscripten/bindings.cpp'],
    commitHashes: ['1122334']
  }),
  
  // M009 converted to a Group Node
  {
    id: 'M009',
    type: 'groupMilestone',
    data: {
      id: 'M009',
      label: 'Remove SecureTransport Support for macOS (Group)',
      category: Category.BREAKING_CHANGE,
      commits: 1,
      srcLoc: 1837,
      startDate: '10/06/23',
      endDate: '10/06/23',
      description: 'Major deprecation initiative broken down into sub-tasks.',
      touchedFiles: ['src/ssl/transport.py'],
      commitHashes: ['9988776']
    },
    position: { x: 0, y: 0 },
    // Made tighter: Width 1400->1200, Height 520->450
    style: { width: 1200, height: 450 }, 
  },
  
  // Sub-nodes for M009 - Compacted Staggered layout
  // A(50,80) -> B(440,270) -> C(830,80)
  createSubNode('M009-A', 'M009', { x: 50, y: 80 }, {
    label: 'Deprecate Legacy API',
    category: Category.MAINTENANCE,
    commits: 2,
    srcLoc: 100,
    startDate: '10/01/23',
    endDate: '10/03/23',
    description: 'Add warning logs to existing SecureTransport calls.',
    touchedFiles: ['src/ssl/transport.py'],
    commitHashes: ['sub1-hash']
  }),
  createSubNode('M009-B', 'M009', { x: 440, y: 270 }, {
    label: 'Remove Native Bindings',
    category: Category.BREAKING_CHANGE,
    commits: 5,
    srcLoc: 1500,
    startDate: '10/04/23',
    endDate: '10/06/23',
    description: 'Delete the actual C-bindings and python wrappers.',
    touchedFiles: ['src/ssl/_core.c'],
    commitHashes: ['sub2-hash']
  }),
  createSubNode('M009-C', 'M009', { x: 830, y: 80 }, {
    label: 'Update Docs & Migration Guide',
    category: Category.MAINTENANCE,
    commits: 1,
    srcLoc: 200,
    startDate: '10/06/23',
    endDate: '10/06/23',
    description: 'Ensure users know how to switch to Network.framework.',
    touchedFiles: ['docs/migration.rst'],
    commitHashes: ['sub3-hash']
  }),

  createNode('M002', {
    label: 'Add read1() Method to HTTPResponse',
    category: Category.MAJOR_FEATURE,
    commits: 4,
    srcLoc: 120,
    startDate: '11/23/23',
    endDate: '02/28/24',
    description: 'Adds support for unbuffered reads from the socket, improving streaming performance.',
    touchedFiles: ['src/response.py'],
    commitHashes: ['5544332']
  }),
  createNode('M006', {
    label: 'Python 3.8 Migration and Type Annotation Mods',
    category: Category.BREAKING_CHANGE,
    commits: 6,
    srcLoc: 266,
    startDate: '10/06/23',
    endDate: '09/03/24',
    description: 'Updates syntax to 3.8+ and enforces strict mypy typing across core modules.',
    touchedFiles: ['setup.py', 'src/core/types.py'],
    commitHashes: ['7766554']
  }),
  createNode('M010', {
    label: 'Drop Python 3.8 Support',
    category: Category.BREAKING_CHANGE,
    commits: 1,
    srcLoc: 53,
    startDate: '10/27/23',
    endDate: '10/27/23',
    description: 'End of life cleanup for Python 3.8.',
    touchedFiles: ['setup.py'],
    commitHashes: ['2233445']
  }),
  createNode('M013', {
    label: 'Typing Updates',
    category: Category.MAINTENANCE,
    commits: 12,
    srcLoc: 90,
    startDate: '10/06/23',
    endDate: '09/28/24',
    description: 'General housekeeping and type hint improvements.',
    touchedFiles: ['src/utils.py'],
    commitHashes: ['1212121']
  }),
  createNode('M015', {
    label: 'Misc Updates',
    category: Category.MAINTENANCE,
    commits: 4,
    srcLoc: 122,
    startDate: '11/04/23',
    endDate: '12/16/24',
    description: 'Miscellaneous bug fixes and documentation updates.',
    touchedFiles: ['docs/index.rst'],
    commitHashes: ['3434343']
  }),
];

const commonEdgeStyle = {
  type: 'default',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
    color: '#64748b',
  },
  style: {
    stroke: '#94a3b8',
    strokeWidth: 2,
  },
  labelStyle: { fill: '#475569', fontWeight: 700, fontSize: 12 },
  labelBgStyle: { fill: '#f1f5f9', fillOpacity: 0.8, rx: 4, ry: 4 },
  labelBgPadding: [4, 2] as [number, number],
  labelBgBorderRadius: 4,
};

// Internal edges made darker and more distinct
const internalEdgeStyle = {
  ...commonEdgeStyle,
  style: { 
    stroke: '#475569', // Stronger slate (Slate-600)
    strokeWidth: 2.5, 
    strokeDasharray: '5 5' 
  }, 
};

export const INITIAL_EDGES: Edge[] = [
  { id: 'eM007-M004', source: 'M007', target: 'M004', label: 'FUNC/weak', data: { type: 'FUNC', strength: 'weak' }, ...commonEdgeStyle },
  { id: 'eM011-M009', source: 'M011', target: 'M009', label: 'FUNC/weak', data: { type: 'FUNC', strength: 'weak' }, ...commonEdgeStyle },
  { id: 'eM004-M015', source: 'M004', target: 'M015', label: 'ARCH/weak', data: { type: 'ARCH', strength: 'weak' }, ...commonEdgeStyle },
  { id: 'eM009-M002', source: 'M009', target: 'M002', label: 'ARCH/weak', data: { type: 'ARCH', strength: 'weak' }, ...commonEdgeStyle },
  { id: 'eM002-M015', source: 'M002', target: 'M015', label: 'FUNC/weak', data: { type: 'FUNC', strength: 'weak' }, ...commonEdgeStyle },
  { id: 'eM006-M009', source: 'M006', target: 'M009', label: 'ARCH/weak', data: { type: 'ARCH', strength: 'weak' }, ...commonEdgeStyle },
  { id: 'eM006-M010', source: 'M006', target: 'M010', label: '', data: { type: 'DEP', strength: 'strong' }, ...commonEdgeStyle },
  { id: 'eM013-M010', source: 'M013', target: 'M010', label: 'FUNC/weak', data: { type: 'FUNC', strength: 'weak' }, ...commonEdgeStyle },
  { id: 'eM010-M002', source: 'M010', target: 'M002', label: 'ARCH/weak', data: { type: 'ARCH', strength: 'weak' }, ...commonEdgeStyle },
  
  // Special routing for M013 -> M015
  { 
    id: 'eM013-M015', 
    source: 'M013', 
    target: 'M015', 
    label: 'FUNC/weak', 
    sourceHandle: 'bottom-source',
    targetHandle: 'bottom-target',
    data: { type: 'FUNC', strength: 'weak' }, 
    ...commonEdgeStyle 
  },

  // INTERNAL EDGES (Sub-milestones)
  { id: 'eM009A-M009B', source: 'M009-A', target: 'M009-B', label: 'Internal', ...internalEdgeStyle },
  { id: 'eM009A-M009C', source: 'M009-A', target: 'M009-C', label: 'Doc', ...internalEdgeStyle },
  { id: 'eM009B-M009C', source: 'M009-B', target: 'M009-C', label: 'Review', ...internalEdgeStyle },
];
