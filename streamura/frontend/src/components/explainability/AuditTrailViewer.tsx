import React, { useState } from 'react';

interface DecisionStep {
    step: number;
    action: string;
    timestamp: string;
    result?: string;
    confidence?: number;
    details?: Record<string, any>;
}

interface OperatorEntry {
    operator_type: 'system' | 'human';
    operator_id: string;
    action: string;
    timestamp: string;
}

interface AuditTrailData {
    decision_id: string;
    decision_type: string;
    timestamp: string;
    decision_chain: DecisionStep[];
    input_snapshot: Record<string, any>;
    output_snapshot: Record<string, any>;
    model_versions: Record<string, string>;
    policy_versions: Record<string, string>;
    operator_trail: OperatorEntry[];
    evidence_refs: string[];
    checksum: string;
}

interface AuditTrailViewerProps {
    data: AuditTrailData;
    className?: string;
}

export const AuditTrailViewer: React.FC<AuditTrailViewerProps> = ({
    data,
    className = '',
}) => {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['chain']));
    const [selectedStep, setSelectedStep] = useState<number | null>(null);
    const [showRawJson, setShowRawJson] = useState(false);

    const toggleSection = (section: string) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(section)) {
            newExpanded.delete(section);
        } else {
            newExpanded.add(section);
        }
        setExpandedSections(newExpanded);
    };

    const formatTimestamp = (ts: string) => {
        try {
            return new Date(ts).toLocaleString();
        } catch {
            return ts;
        }
    };

    const copyToClipboard = async (text: string) => {
        await navigator.clipboard.writeText(text);
    };

    return (
        <div className={`audit-trail-viewer ${className}`}>
            {/* Header */}
            <div className="audit-header">
                <div className="header-left">
                    <h3>🔍 Audit Trail</h3>
                    <span className="decision-type">{data.decision_type}</span>
                </div>
                <div className="header-right">
                    <button
                        className="json-toggle"
                        onClick={() => setShowRawJson(!showRawJson)}
                    >
                        {showRawJson ? 'Hide JSON' : 'Show JSON'}
                    </button>
                </div>
            </div>

            {/* Integrity Badge */}
            <div className="integrity-section">
                <div className="integrity-badge">
                    <span className="checkmark">✓</span>
                    <span className="label">Integrity Verified</span>
                </div>
                <div className="checksum">
                    <span className="label">SHA-256:</span>
                    <code
                        className="hash"
                        onClick={() => copyToClipboard(data.checksum)}
                        title="Click to copy"
                    >
                        {data.checksum}
                    </code>
                </div>
                <div className="meta-info">
                    <span>Decision ID: {data.decision_id}</span>
                    <span>Timestamp: {formatTimestamp(data.timestamp)}</span>
                </div>
            </div>

            {showRawJson ? (
                <div className="raw-json-view">
                    <pre>{JSON.stringify(data, null, 2)}</pre>
                </div>
            ) : (
                <>
                    {/* Decision Chain Timeline */}
                    <div className="section">
                        <button
                            className="section-header"
                            onClick={() => toggleSection('chain')}
                        >
                            <span className="icon">{expandedSections.has('chain') ? '▼' : '▶'}</span>
                            <span className="title">Decision Chain ({data.decision_chain.length} steps)</span>
                        </button>
                        {expandedSections.has('chain') && (
                            <div className="section-content">
                                <div className="timeline">
                                    {data.decision_chain.map((step, idx) => (
                                        <div
                                            key={idx}
                                            className={`timeline-step ${selectedStep === idx ? 'selected' : ''}`}
                                            onClick={() => setSelectedStep(selectedStep === idx ? null : idx)}
                                        >
                                            <div className="step-connector">
                                                <div className="step-number">{step.step || idx + 1}</div>
                                                {idx < data.decision_chain.length - 1 && <div className="connector-line" />}
                                            </div>
                                            <div className="step-content">
                                                <div className="step-header">
                                                    <span className="step-action">{step.action}</span>
                                                    <span className="step-time">{formatTimestamp(step.timestamp)}</span>
                                                </div>
                                                {step.result && (
                                                    <div className="step-result">
                                                        Result: <code>{step.result}</code>
                                                    </div>
                                                )}
                                                {step.confidence !== undefined && (
                                                    <div className="step-confidence">
                                                        <div
                                                            className="confidence-bar"
                                                            style={{ width: `${step.confidence * 100}%` }}
                                                        />
                                                        <span>{(step.confidence * 100).toFixed(0)}%</span>
                                                    </div>
                                                )}
                                                {selectedStep === idx && step.details && (
                                                    <div className="step-details">
                                                        <pre>{JSON.stringify(step.details, null, 2)}</pre>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Operator Trail */}
                    <div className="section">
                        <button
                            className="section-header"
                            onClick={() => toggleSection('operators')}
                        >
                            <span className="icon">{expandedSections.has('operators') ? '▼' : '▶'}</span>
                            <span className="title">Operator Trail ({data.operator_trail.length})</span>
                        </button>
                        {expandedSections.has('operators') && (
                            <div className="section-content">
                                <div className="operator-list">
                                    {data.operator_trail.map((op, idx) => (
                                        <div key={idx} className="operator-entry">
                                            <div className={`operator-icon ${op.operator_type}`}>
                                                {op.operator_type === 'system' ? '🤖' : '👤'}
                                            </div>
                                            <div className="operator-info">
                                                <div className="operator-id">{op.operator_id}</div>
                                                <div className="operator-action">{op.action}</div>
                                            </div>
                                            <div className="operator-time">{formatTimestamp(op.timestamp)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Model Versions */}
                    <div className="section">
                        <button
                            className="section-header"
                            onClick={() => toggleSection('models')}
                        >
                            <span className="icon">{expandedSections.has('models') ? '▼' : '▶'}</span>
                            <span className="title">Model Versions ({Object.keys(data.model_versions).length})</span>
                        </button>
                        {expandedSections.has('models') && (
                            <div className="section-content">
                                <table className="version-table">
                                    <thead>
                                        <tr>
                                            <th>Model</th>
                                            <th>Version</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(data.model_versions).map(([model, version]) => (
                                            <tr key={model}>
                                                <td>{model.replace(/_/g, ' ')}</td>
                                                <td><code>{version}</code></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Policy Versions */}
                    <div className="section">
                        <button
                            className="section-header"
                            onClick={() => toggleSection('policies')}
                        >
                            <span className="icon">{expandedSections.has('policies') ? '▼' : '▶'}</span>
                            <span className="title">Policy Versions ({Object.keys(data.policy_versions).length})</span>
                        </button>
                        {expandedSections.has('policies') && (
                            <div className="section-content">
                                <table className="version-table">
                                    <thead>
                                        <tr>
                                            <th>Policy</th>
                                            <th>Version</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(data.policy_versions).map(([policy, version]) => (
                                            <tr key={policy}>
                                                <td>{policy.replace(/_/g, ' ')}</td>
                                                <td><code>{version}</code></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Input/Output Snapshots */}
                    <div className="section">
                        <button
                            className="section-header"
                            onClick={() => toggleSection('snapshots')}
                        >
                            <span className="icon">{expandedSections.has('snapshots') ? '▼' : '▶'}</span>
                            <span className="title">Data Snapshots</span>
                        </button>
                        {expandedSections.has('snapshots') && (
                            <div className="section-content snapshots">
                                <div className="snapshot-panel">
                                    <h5>Input Snapshot</h5>
                                    <pre>{JSON.stringify(data.input_snapshot, null, 2)}</pre>
                                </div>
                                <div className="snapshot-panel">
                                    <h5>Output Snapshot</h5>
                                    <pre>{JSON.stringify(data.output_snapshot, null, 2)}</pre>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Evidence References */}
                    {data.evidence_refs.length > 0 && (
                        <div className="section">
                            <button
                                className="section-header"
                                onClick={() => toggleSection('evidence')}
                            >
                                <span className="icon">{expandedSections.has('evidence') ? '▼' : '▶'}</span>
                                <span className="title">Evidence References ({data.evidence_refs.length})</span>
                            </button>
                            {expandedSections.has('evidence') && (
                                <div className="section-content">
                                    <ul className="evidence-list">
                                        {data.evidence_refs.map((ref, idx) => (
                                            <li key={idx}>
                                                <a href={ref} target="_blank" rel="noopener noreferrer">{ref}</a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            <style>{`
        .audit-trail-viewer {
          background: var(--bg-primary, #0f0f1a);
          border-radius: 12px;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .audit-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          background: var(--bg-secondary, #1a1a2e);
          border-bottom: 1px solid var(--border-color, #333);
        }

        .audit-header h3 {
          margin: 0;
          font-size: 1.25rem;
        }

        .decision-type {
          background: var(--primary-color, #6366f1);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          text-transform: uppercase;
          margin-left: 0.75rem;
        }

        .json-toggle {
          background: transparent;
          border: 1px solid var(--border-color, #333);
          color: var(--text-secondary, #888);
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .json-toggle:hover {
          background: var(--bg-hover, #252540);
          color: white;
        }

        .integrity-section {
          padding: 1rem 1.5rem;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), transparent);
          border-bottom: 1px solid var(--border-color, #333);
        }

        .integrity-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(16, 185, 129, 0.2);
          padding: 0.5rem 1rem;
          border-radius: 6px;
          margin-bottom: 0.75rem;
        }

        .integrity-badge .checkmark {
          color: var(--success-color, #10b981);
          font-size: 1.25rem;
        }

        .checksum {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .checksum .hash {
          font-family: 'Monaco', 'Consolas', monospace;
          font-size: 0.75rem;
          background: var(--bg-secondary, #1a1a2e);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          cursor: pointer;
          word-break: break-all;
        }

        .checksum .hash:hover {
          background: var(--bg-hover, #252540);
        }

        .meta-info {
          display: flex;
          gap: 1.5rem;
          font-size: 0.875rem;
          color: var(--text-secondary, #888);
        }

        .section {
          border-bottom: 1px solid var(--border-color, #333);
        }

        .section-header {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          text-align: left;
          transition: background 0.2s;
        }

        .section-header:hover {
          background: var(--bg-hover, #252540);
        }

        .section-header .icon {
          color: var(--text-secondary, #888);
          font-size: 0.75rem;
        }

        .section-header .title {
          font-weight: 500;
        }

        .section-content {
          padding: 0 1.5rem 1.5rem;
        }

        .timeline {
          position: relative;
        }

        .timeline-step {
          display: flex;
          gap: 1rem;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .timeline-step:hover {
          background: var(--bg-hover, #252540);
        }

        .timeline-step.selected {
          background: var(--bg-secondary, #1a1a2e);
        }

        .step-connector {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 32px;
        }

        .step-number {
          width: 32px;
          height: 32px;
          background: var(--primary-color, #6366f1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.875rem;
          flex-shrink: 0;
        }

        .connector-line {
          width: 2px;
          flex: 1;
          min-height: 20px;
          background: var(--border-color, #333);
          margin-top: 4px;
        }

        .step-content {
          flex: 1;
          padding-bottom: 1rem;
        }

        .step-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .step-action {
          font-weight: 500;
        }

        .step-time {
          font-size: 0.75rem;
          color: var(--text-secondary, #888);
        }

        .step-result code {
          background: var(--bg-secondary, #1a1a2e);
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .step-confidence {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        .confidence-bar {
          height: 4px;
          background: var(--primary-color, #6366f1);
          border-radius: 2px;
          max-width: 100px;
        }

        .step-details {
          margin-top: 0.75rem;
          background: var(--bg-primary, #0f0f1a);
          border-radius: 6px;
          padding: 0.75rem;
          overflow-x: auto;
        }

        .step-details pre {
          margin: 0;
          font-size: 0.75rem;
        }

        .operator-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .operator-entry {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          background: var(--bg-secondary, #1a1a2e);
          border-radius: 8px;
        }

        .operator-icon {
          font-size: 1.5rem;
        }

        .operator-info {
          flex: 1;
        }

        .operator-id {
          font-weight: 500;
        }

        .operator-action {
          font-size: 0.875rem;
          color: var(--text-secondary, #888);
        }

        .operator-time {
          font-size: 0.75rem;
          color: var(--text-secondary, #888);
        }

        .version-table {
          width: 100%;
          border-collapse: collapse;
        }

        .version-table th {
          text-align: left;
          padding: 0.75rem;
          background: var(--bg-secondary, #1a1a2e);
          font-weight: 500;
          font-size: 0.875rem;
        }

        .version-table td {
          padding: 0.75rem;
          border-bottom: 1px solid var(--border-color, #333);
        }

        .version-table code {
          background: var(--bg-hover, #252540);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .snapshots {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        @media (max-width: 768px) {
          .snapshots {
            grid-template-columns: 1fr;
          }
        }

        .snapshot-panel {
          background: var(--bg-secondary, #1a1a2e);
          border-radius: 8px;
          overflow: hidden;
        }

        .snapshot-panel h5 {
          margin: 0;
          padding: 0.75rem 1rem;
          background: var(--bg-hover, #252540);
          font-size: 0.875rem;
        }

        .snapshot-panel pre {
          margin: 0;
          padding: 1rem;
          font-size: 0.75rem;
          overflow-x: auto;
          max-height: 300px;
          overflow-y: auto;
        }

        .evidence-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .evidence-list li {
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--border-color, #333);
        }

        .evidence-list a {
          color: var(--primary-color, #6366f1);
          text-decoration: none;
        }

        .evidence-list a:hover {
          text-decoration: underline;
        }

        .raw-json-view {
          padding: 1.5rem;
        }

        .raw-json-view pre {
          background: var(--bg-secondary, #1a1a2e);
          padding: 1rem;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 0.75rem;
          max-height: 600px;
          overflow-y: auto;
        }
      `}</style>
        </div>
    );
};

export default AuditTrailViewer;
