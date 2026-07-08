import './detailpanel.css';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Link as LinkIcon, FileText, Hash, Calendar, Info, Code, FileCode, ChevronDown, ChevronRight, TestTube, BookOpen } from 'lucide-react';
import { MilestoneData, DependencyData } from '../types';
import { Node, Edge } from 'reactflow';
import clsx from 'clsx';
import { CAT } from './theme';

interface DetailPanelProps {
  selectedNode: Node<MilestoneData> | null;
  selectedEdge: Edge | null;
  onClose: () => void;
  allNodes: Node<MilestoneData>[];
  basePath: string | null;
}

type ImpactMetrics = {
  commits: number;
  additions: number;
  deletions: number;
  srcAdditions: number;
  srcDeletions: number;
  srcLoc: number;
};

/** Lightweight markdown → HTML (headings, bold, italic, code, lists, hr, paragraphs). */
function renderMarkdown(md: string): string {
  return md
    // code blocks (fenced)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="dp-srs-pre"><code>$2</code></pre>')
    // inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // headings
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // horizontal rules
    .replace(/^---+$/gm, '<hr class="dp-srs-hr" />')
    // bold & italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // unordered list items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // wrap consecutive <li> in <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul class="dp-srs-ul">$1</ul>')
    // paragraphs — lines that aren't already HTML tags
    .replace(/^(?!<[a-z/])((?!\s*$).+)$/gm, '<p>$1</p>')
    // collapse blank lines
    .replace(/\n{3,}/g, '\n\n');
}

const normalizeCommit = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const DetailPanel: React.FC<DetailPanelProps> = ({ selectedNode, selectedEdge, onClose, allNodes, basePath }) => {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [srsContent, setSrsContent] = useState<string | null>(null);
  const [srsLoading, setSrsLoading] = useState(false);
  const [srsError, setSrsError] = useState<string | null>(null);
  const [showSrsModal, setShowSrsModal] = useState(false);

  useEffect(() => {
    if (titleRef.current) {
      setIsTruncated(titleRef.current.scrollWidth > titleRef.current.clientWidth);
    }
  }, [selectedNode?.id]);

  // Reset SRS state when node changes
  useEffect(() => {
    setSrsContent(null);
    setSrsError(null);
    setShowSrsModal(false);
  }, [selectedNode?.id]);

  const fetchSrs = useCallback(async () => {
    if (!selectedNode || !basePath) return;
    setSrsLoading(true);
    setSrsError(null);
    try {
      const url = `${basePath}/srs/${selectedNode.id}/SRS.md`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status === 404 ? 'SRS not found for this milestone' : `Failed to load SRS (${res.status})`);
      const text = await res.text();
      setSrsContent(text);
      setShowSrsModal(true);
    } catch (err) {
      setSrsError(err instanceof Error ? err.message : 'Failed to load SRS');
      setShowSrsModal(true);
    } finally {
      setSrsLoading(false);
    }
  }, [selectedNode, basePath]);

  if (!selectedNode && !selectedEdge) return null;

  const isGroupNode = Boolean(selectedNode && selectedNode.type === 'groupMilestone');
  const childNodes = selectedNode && isGroupNode
    ? allNodes.filter((node) => node.parentNode === selectedNode.id)
    : [];
  const hasChildren = childNodes.length > 0;

  const impactMetrics: ImpactMetrics | null = selectedNode
    ? (hasChildren
        ? childNodes.reduce<ImpactMetrics>((acc, node) => {
            const data = node.data;
            acc.commits += data.commits || 0;
            acc.additions += data.additions || 0;
            acc.deletions += data.deletions || 0;
            acc.srcAdditions += data.srcAdditions || 0;
            acc.srcDeletions += data.srcDeletions || 0;
            acc.srcLoc += data.srcLoc || 0;
            return acc;
          }, { commits: 0, additions: 0, deletions: 0, srcAdditions: 0, srcDeletions: 0, srcLoc: 0 })
        : {
            commits: selectedNode.data.commits,
            additions: selectedNode.data.additions,
            deletions: selectedNode.data.deletions,
            srcAdditions: selectedNode.data.srcAdditions,
            srcDeletions: selectedNode.data.srcDeletions,
            srcLoc: selectedNode.data.srcLoc,
          })
    : null;

  const integrationTestCommits = selectedNode ? (() => {
    const commits: string[] = [];
    const seen = new Set<string>();
    const pushCommit = (value?: string | null) => {
      const normalized = normalizeCommit(value || undefined);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        commits.push(normalized);
      }
    };

    pushCommit(selectedNode.data.integrationTestCommit);
    if (hasChildren) {
      childNodes.forEach((node) => pushCommit(node.data.integrationTestCommit));
    }
    return commits;
  })() : [];

  const commitHashesForDisplay = selectedNode ? (() => {
    const commits: string[] = [];
    const seen = new Set<string>();
    const pushCommit = (value?: string | null) => {
      const normalized = normalizeCommit(value || undefined);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        commits.push(normalized);
      }
    };

    selectedNode.data.commitHashes.forEach((hash) => pushCommit(hash));
    if (hasChildren) {
      childNodes.forEach((node) => node.data.commitHashes.forEach((hash) => pushCommit(hash)));
    }
    integrationTestCommits.forEach((hash) => pushCommit(hash));
    return commits;
  })() : [];

  const isIntegrationCommit = (hash: string) => {
    const normalizedHash = normalizeCommit(hash);
    if (!normalizedHash) return false;
    return integrationTestCommits.some((integration) =>
      integration === normalizedHash
      || integration.startsWith(normalizedHash)
      || normalizedHash.startsWith(integration)
    );
  };

  return (
    <div className="dp-panel">
      {/* Header */}
      <div className="dp-header">
        <div className={clsx('dp-header-top', isTruncated && 'dp-header-top-tight')}>
          <h2 ref={titleRef} className="dp-title" title={selectedNode ? selectedNode.id : 'Edge Details'}>
            {selectedNode ? selectedNode.id : 'Edge Details'}
          </h2>
          <button onClick={onClose} className="dp-close-btn">
            <X size={18} />
          </button>
        </div>
        {selectedNode && isTruncated && (
          <div className="dp-id-wrap">
            <div className="dp-id-chip">
              {selectedNode.id}
            </div>
          </div>
        )}
      </div>

      <div className="dp-body">
        {/* Node Details */}
        {selectedNode && (
          <div className="dp-stack-6">
            <div>
              <h3 className="dp-node-title">{selectedNode.data.label}</h3>
              <div className="dp-badge-row">
                <div className="dp-cat-badge">
                  <span className="dp-cat-dot" style={{ background: CAT[selectedNode.data.category]?.fg || '#79b8f2' }}></span>
                  {selectedNode.data.category}
                </div>
                {basePath && (
                  <button
                    onClick={fetchSrs}
                    disabled={srsLoading}
                    className="dp-srs-btn"
                  >
                    <BookOpen size={12} />
                    {srsLoading ? 'Loading...' : 'View SRS'}
                  </button>
                )}
              </div>
            </div>

            {/* Mini-SRS / Rationale */}
            <div className="dp-stack-3">
              <SectionTitle icon={<Info size={16} />} title="Description" />
              <div className="dp-description">
                {selectedNode.data.miniSrs || selectedNode.data.description}
              </div>
            </div>

            {/* Detailed Stats Grid */}
            <div className="dp-stack-3">
              <SectionTitle icon={<ActivityIcon size={16} />} title="Impact Metrics" />
              <div className="dp-stat-grid-3">
                  <StatBox label="Commits" value={impactMetrics?.commits ?? 0} icon={<Hash />} />
                  <StatBox
                    label="Total Chg"
                    value={`+${impactMetrics?.additions ?? 0} / -${impactMetrics?.deletions ?? 0}`}
                    icon={<FileText />}
                    subValue={`${(impactMetrics?.additions ?? 0) + (impactMetrics?.deletions ?? 0)} LoC`}
                  />
                  <StatBox label="Src Size" value={impactMetrics?.srcLoc ?? 0} icon={<Code />} subValue="Current LoC" />
               </div>
               <div className="dp-src-grid">
                  <div className="dp-src-box dp-src-added">
                     <span className="dp-src-label">Src Added</span>
                     <span className="dp-src-value">+{impactMetrics?.srcAdditions ?? 0}</span>
                  </div>
                  <div className="dp-src-box dp-src-deleted">
                     <span className="dp-src-label">Src Deleted</span>
                     <span className="dp-src-value">-{impactMetrics?.srcDeletions ?? 0}</span>
                  </div>
               </div>
            </div>

            <div className="dp-stat-grid-2">
                <StatBox label="Start" value={selectedNode.data.startDate} icon={<Calendar />} />
                <StatBox label="End" value={selectedNode.data.endDate} icon={<Calendar />} />
            </div>

            {/* Collapsible Files Sections */}
            <div className="dp-stack-4 dp-files-section">
              <CollapsibleSection
                title="Touched Source Files"
                count={selectedNode.data.touchedSrcFiles.length}
                icon={<FileCode size={16} className="dp-icon-blue"/>}
              >
                 <ul className="dp-file-list">
                  {selectedNode.data.touchedSrcFiles.map((file, idx) => (
                    <li key={idx} className="dp-file-item">
                      {file}
                    </li>
                  ))}
                 </ul>
              </CollapsibleSection>

              <CollapsibleSection
                title="Touched Test Files"
                count={selectedNode.data.touchedTestFiles.length}
                icon={<TestTube size={16} className="dp-icon-green"/>}
              >
                 <ul className="dp-file-list">
                  {selectedNode.data.touchedTestFiles.map((file, idx) => (
                    <li key={idx} className="dp-file-item">
                      {file}
                    </li>
                  ))}
                 </ul>
              </CollapsibleSection>
            </div>

            {/* Commit Hashes */}
            {commitHashesForDisplay.length > 0 && (
                <div className="dp-stack-3 dp-commits-section">
                <SectionTitle icon={<LinkIcon size={16} />} title="Commits" />
                <div className="dp-commit-chips">
                    {commitHashesForDisplay.map((hash) => (
                    <span
                      key={hash}
                      className={clsx('dp-commit-chip', isIntegrationCommit(hash) && 'dp-commit-chip-integration')}
                      title={isIntegrationCommit(hash) ? 'integration_test_commit' : undefined}
                    >
                      {hash}
                    </span>
                    ))}
                </div>
                </div>
            )}
          </div>
        )}

        {/* SRS Modal */}
        {showSrsModal && (
          <div
            className="dp-modal-overlay"
            onClick={() => setShowSrsModal(false)}
          >
            <div
              className="dp-modal"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="dp-modal-header">
                <div className="dp-modal-header-left">
                  <BookOpen size={16} className="dp-modal-icon" />
                  <span className="dp-modal-title">Software Requirements Specification</span>
                  <span className="dp-modal-id">{selectedNode?.id}</span>
                </div>
                <button
                  onClick={() => setShowSrsModal(false)}
                  className="dp-close-btn"
                >
                  <X size={16} />
                </button>
              </div>
              {/* Modal Body */}
              <div className="dp-modal-body">
                {srsError ? (
                  <div className="dp-srs-error">{srsError}</div>
                ) : srsContent ? (
                  <div
                    className="dp-srs"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(srsContent) }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Edge Details */}
        {selectedEdge && (
          <div className="dp-stack-6">
             <div>
              <h3 className="dp-node-title dp-edge-title">Dependency Relationship</h3>
              <p className="dp-edge-sub">
                {selectedEdge.source} <span className="dp-edge-arrow">➔</span> {selectedEdge.target}
              </p>
            </div>

            <div className="dp-edge-box dp-stack-2">
               <div className="dp-edge-row">
                 <span className="dp-edge-label">Type</span>
                 <span className="dp-edge-value">{(selectedEdge.data as DependencyData)?.type || 'N/A'}</span>
               </div>
               <div className="dp-edge-row">
                 <span className="dp-edge-label">Strength</span>
                 <span className="dp-edge-value dp-edge-value-upper">{(selectedEdge.data as DependencyData)?.strength || 'N/A'}</span>
               </div>
            </div>

            <div className="dp-stack-2">
              <SectionTitle icon={<Info size={16} />} title="Rationale" />
              <div className="dp-rationale">
                {(selectedEdge.data as DependencyData)?.description || (selectedEdge.data as any)?.rationale || "No specific rationale provided."}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Sub Components ---

const SectionTitle = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <h4 className="dp-section-title">
    {icon} {title}
  </h4>
);

const ActivityIcon = ({size}: {size: number}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
);

const StatBox = ({ label, value, icon, subValue }: { label: string; value: string | number; icon: React.ReactNode; subValue?: string }) => (
  <div className="dp-statbox">
    <div className="dp-statbox-label">
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 12 }) : icon}
      {label}
    </div>
    <div className="dp-statbox-value">{value}</div>
    {subValue && <div className="dp-statbox-sub">{subValue}</div>}
  </div>
);

const CollapsibleSection = ({ title, count, icon, children }: { title: string; count: number; icon: React.ReactNode; children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (count === 0) return null;

    return (
        <div className="dp-collapsible">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="dp-collapsible-header"
            >
                <div className="dp-collapsible-header-left">
                    {icon}
                    <span>{title}</span>
                    <span className="dp-collapsible-count">{count}</span>
                </div>
                {isOpen ? <ChevronDown size={16} className="dp-collapsible-chevron" /> : <ChevronRight size={16} className="dp-collapsible-chevron" />}
            </button>
            {isOpen && (
                <div className="dp-collapsible-body">
                    {children}
                </div>
            )}
        </div>
    );
}

export default DetailPanel;
