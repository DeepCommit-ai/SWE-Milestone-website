export enum Category {
  SECURITY_FIX = 'SECURITY_FIX',
  ARCHITECTURAL_REFACTOR = 'ARCHITECTURAL_REFACTOR',
  PLATFORM_SUPPORT = 'PLATFORM_SUPPORT',
  BREAKING_CHANGE = 'BREAKING_CHANGE',
  MAJOR_FEATURE = 'MAJOR_FEATURE',
  MAINTENANCE = 'MAINTENANCE',
}

export interface MilestoneData {
  id: string;
  label: string;
  category: Category;
  commits: number;
  srcLoc: number;
  startDate: string;
  endDate: string;
  description: string;
  miniSrs: string;

  // Diff metrics
  additions: number;
  deletions: number;
  srcAdditions: number;
  srcDeletions: number;

  // File details
  touchedSrcFiles: string[];
  touchedTestFiles: string[];
  commitHashes: string[];
  integrationTestCommit?: string;

  // Topology view metadata
  topoLayer?: number;
  unlockBatch?: number;
  inDegree?: number;
  outDegree?: number;
  isIsolated?: boolean;

  // Benchmark scope metadata supplied by analysis/data/milestone_info.csv.
  isNonGraded?: boolean;
}

export interface DependencyData {
  type: 'FUNC' | 'ARCH' | 'NFR' | 'TEXT';
  semanticType?: 'FUNC' | 'ARCH' | 'NFR' | 'TEXT';
  strength: 'weak' | 'strong';
  edgeClass?: 'strong' | 'weak';
  label?: string;
  labelVisible?: boolean;
  description?: string;
  rationale?: string;
  isAdditional?: boolean;
}
