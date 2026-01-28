import React, { useState, useEffect } from 'react';

interface ViewerExplanation {
    summary: string;
    action_taken: string;
    what_you_can_do: string | null;
}

interface CreatorExplanation {
    summary: string;
    what_happened: string;
    why_it_happened: string;
    metrics: Record<string, any>;
    peer_comparison: Record<string, any> | null;
    improvement_tips: string[];
    impact_on_trust_score: number | null;
}

interface ModeratorExplanation {
    summary: string;
    decision_rationale: string;
    evidence: Array<{ type: string; value: any; timestamp?: string }>;
    policy_violations: Array<{ name: string; url: string }>;
    similar_cases: Array<Record<string, any>>;
    recommended_action: string;
    confidence_score: number;
    flags: string[];
}

interface AuditorExplanation {
    decision_id: string;
    decision_type: string;
    timestamp: string;
    decision_chain: Array<Record<string, any>>;
    input_snapshot: Record<string, any>;
    output_snapshot: Record<string, any>;
    model_versions: Record<string, string>;
    policy_versions: Record<string, string>;
    operator_trail: Array<Record<string, any>>;
    evidence_refs: string[];
    checksum: string;
}

type ExplanationType = ViewerExplanation | CreatorExplanation | ModeratorExplanation | AuditorExplanation;

interface ExplainabilityPanelProps {
    decisionId: number | string;
    decisionType: 'moderation' | 'trust' | 'payout' | 'discovery';
    availableViews: Array<'viewer' | 'creator' | 'moderator' | 'auditor'>;
    defaultView?: 'viewer' | 'creator' | 'moderator' | 'auditor';
    className?: string;
}

const API_BASE = '/api/v1';

export const ExplainabilityPanel: React.FC<ExplainabilityPanelProps> = ({
    decisionId,
    decisionType,
    availableViews,
    defaultView = 'viewer',
    className = '',
}) => {
    const [activeView, setActiveView] = useState<string>(defaultView);
    const [explanation, setExplanation] = useState<ExplanationType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchExplanation();
    }, [decisionId, activeView]);

    const fetchExplanation = async () => {
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            let endpoint = '';

            if (decisionType === 'moderation') {
                endpoint = `${API_BASE}/moderation/${decisionId}/explanation?view=${activeView}`;
            } else if (decisionType === 'trust') {
                endpoint = `${API_BASE}/trust/${decisionId}/explanation?view=${activeView}`;
            } else {
                endpoint = `${API_BASE}/explain/${decisionId}?view=${activeView}`;
            }

            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch explanation');
            }

            const data = await response.json();
            setExplanation(data.explanation);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const renderViewerExplanation = (exp: ViewerExplanation) => (
        <div className="viewer-explanation">
            <div className="explanation-card simple">
                <div className="summary">
                    <span className="icon">ℹ️</span>
                    <p>{exp.summary}</p>
                </div>
                <div className="action-taken">
                    <strong>What happened:</strong> {exp.action_taken}
                </div>
                {exp.what_you_can_do && (
                    <div className="next-steps">
                        <strong>What you can do:</strong> {exp.what_you_can_do}
                    </div>
                )}
            </div>
        </div>
    );

    const renderCreatorExplanation = (exp: CreatorExplanation) => (
        <div className="creator-explanation">
            <div className="explanation-card detailed">
                <h4>{exp.summary}</h4>

                <div className="section">
                    <h5>What Happened</h5>
                    <p>{exp.what_happened}</p>
                </div>

                <div className="section">
                    <h5>Why It Happened</h5>
                    <p>{exp.why_it_happened}</p>
                </div>

                {Object.keys(exp.metrics).length > 0 && (
                    <div className="section metrics">
                        <h5>Metrics</h5>
                        <div className="metrics-grid">
                            {Object.entries(exp.metrics).map(([key, value]) => (
                                <div key={key} className="metric-item">
                                    <span className="metric-label">{key.replace(/_/g, ' ')}</span>
                                    <span className="metric-value">
                                        {typeof value === 'number' ? value.toFixed(2) : String(value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {exp.peer_comparison && (
                    <div className="section peer-comparison">
                        <h5>How You Compare</h5>
                        <div className="comparison-bar">
                            <span className="percentile">Top {100 - (exp.peer_comparison.your_percentile || 0)}%</span>
                        </div>
                    </div>
                )}

                {exp.improvement_tips.length > 0 && (
                    <div className="section tips">
                        <h5>💡 Tips to Improve</h5>
                        <ul>
                            {exp.improvement_tips.map((tip, idx) => (
                                <li key={idx}>{tip}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {exp.impact_on_trust_score !== null && (
                    <div className="trust-impact">
                        <span className={exp.impact_on_trust_score >= 0 ? 'positive' : 'negative'}>
                            Trust Score Impact: {exp.impact_on_trust_score >= 0 ? '+' : ''}{exp.impact_on_trust_score.toFixed(1)}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );

    const renderModeratorExplanation = (exp: ModeratorExplanation) => (
        <div className="moderator-explanation">
            <div className="explanation-card evidence-based">
                <div className="header">
                    <h4>{exp.summary}</h4>
                    <div className="confidence-badge">
                        Confidence: {(exp.confidence_score * 100).toFixed(0)}%
                    </div>
                </div>

                {exp.flags.length > 0 && (
                    <div className="flags">
                        {exp.flags.map((flag, idx) => (
                            <span key={idx} className="flag-badge">{flag}</span>
                        ))}
                    </div>
                )}

                <div className="section">
                    <h5>Decision Rationale</h5>
                    <p>{exp.decision_rationale}</p>
                </div>

                <div className="section evidence">
                    <h5>Evidence ({exp.evidence.length})</h5>
                    {exp.evidence.map((item, idx) => (
                        <div key={idx} className="evidence-item">
                            <span className="evidence-type">{item.type}</span>
                            <pre className="evidence-content">
                                {typeof item.value === 'string' ? item.value : JSON.stringify(item.value, null, 2)}
                            </pre>
                        </div>
                    ))}
                </div>

                {exp.policy_violations.length > 0 && (
                    <div className="section policies">
                        <h5>Policy Violations</h5>
                        <ul>
                            {exp.policy_violations.map((policy, idx) => (
                                <li key={idx}>
                                    <a href={policy.url} target="_blank" rel="noopener noreferrer">
                                        {policy.name}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {exp.similar_cases.length > 0 && (
                    <div className="section similar-cases">
                        <h5>Similar Cases ({exp.similar_cases.length})</h5>
                        <div className="cases-carousel">
                            {exp.similar_cases.slice(0, 3).map((c, idx) => (
                                <div key={idx} className="case-card">
                                    <span className="case-id">Case #{c.id}</span>
                                    <span className="case-outcome">{c.outcome}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="recommended-action">
                    <strong>Recommended Action:</strong> {exp.recommended_action}
                </div>
            </div>
        </div>
    );

    const renderAuditorExplanation = (exp: AuditorExplanation) => (
        <div className="auditor-explanation">
            <div className="explanation-card audit-trail">
                <div className="header">
                    <h4>Audit Trail</h4>
                    <code className="decision-id">{exp.decision_id}</code>
                </div>

                <div className="checksum">
                    <span className="label">Integrity Checksum:</span>
                    <code>{exp.checksum.substring(0, 16)}...</code>
                </div>

                <div className="section timeline">
                    <h5>Decision Chain</h5>
                    <div className="timeline-container">
                        {exp.decision_chain.map((step, idx) => (
                            <div key={idx} className="timeline-item">
                                <div className="timeline-marker">{idx + 1}</div>
                                <div className="timeline-content">
                                    <span className="step-action">{step.action}</span>
                                    <span className="step-timestamp">{step.timestamp}</span>
                                    {step.confidence && (
                                        <span className="step-confidence">
                                            Confidence: {(step.confidence * 100).toFixed(0)}%
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="section versions">
                    <h5>Model Versions</h5>
                    <table className="version-table">
                        <tbody>
                            {Object.entries(exp.model_versions).map(([model, version]) => (
                                <tr key={model}>
                                    <td>{model}</td>
                                    <td><code>{version}</code></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="section versions">
                    <h5>Policy Versions</h5>
                    <table className="version-table">
                        <tbody>
                            {Object.entries(exp.policy_versions).map(([policy, version]) => (
                                <tr key={policy}>
                                    <td>{policy}</td>
                                    <td><code>{version}</code></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="section operator-trail">
                    <h5>Operator Trail</h5>
                    {exp.operator_trail.map((op, idx) => (
                        <div key={idx} className="operator-entry">
                            <span className="operator-type">{op.operator_type}</span>
                            <span className="operator-id">{op.operator_id}</span>
                            <span className="operator-action">{op.action}</span>
                            <span className="operator-time">{op.timestamp}</span>
                        </div>
                    ))}
                </div>

                <details className="raw-data">
                    <summary>Raw Input Snapshot</summary>
                    <pre>{JSON.stringify(exp.input_snapshot, null, 2)}</pre>
                </details>

                <details className="raw-data">
                    <summary>Raw Output Snapshot</summary>
                    <pre>{JSON.stringify(exp.output_snapshot, null, 2)}</pre>
                </details>
            </div>
        </div>
    );

    const renderExplanation = () => {
        if (!explanation) return null;

        switch (activeView) {
            case 'viewer':
                return renderViewerExplanation(explanation as ViewerExplanation);
            case 'creator':
                return renderCreatorExplanation(explanation as CreatorExplanation);
            case 'moderator':
                return renderModeratorExplanation(explanation as ModeratorExplanation);
            case 'auditor':
                return renderAuditorExplanation(explanation as AuditorExplanation);
            default:
                return null;
        }
    };

    const viewLabels: Record<string, string> = {
        viewer: '👁️ Simple View',
        creator: '📊 Creator View',
        moderator: '🛡️ Moderator View',
        auditor: '📋 Audit Trail',
    };

    return (
        <div className={`explainability-panel ${className}`}>
            <div className="view-tabs">
                {availableViews.map((view) => (
                    <button
                        key={view}
                        className={`tab-button ${activeView === view ? 'active' : ''}`}
                        onClick={() => setActiveView(view)}
                    >
                        {viewLabels[view]}
                    </button>
                ))}
            </div>

            <div className="explanation-content">
                {loading && (
                    <div className="loading-state">
                        <div className="spinner" />
                        <p>Loading explanation...</p>
                    </div>
                )}

                {error && (
                    <div className="error-state">
                        <span className="error-icon">⚠️</span>
                        <p>{error}</p>
                        <button onClick={fetchExplanation}>Try Again</button>
                    </div>
                )}

                {!loading && !error && renderExplanation()}
            </div>

            <style>{`
        .explainability-panel {
          background: var(--bg-secondary, #1a1a2e);
          border-radius: 12px;
          overflow: hidden;
        }
        
        .view-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-color, #333);
          padding: 0.5rem;
          gap: 0.5rem;
        }
        
        .tab-button {
          padding: 0.5rem 1rem;
          background: transparent;
          border: none;
          color: var(--text-secondary, #888);
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }
        
        .tab-button:hover {
          background: var(--bg-hover, #252540);
        }
        
        .tab-button.active {
          background: var(--primary-color, #6366f1);
          color: white;
        }
        
        .explanation-content {
          padding: 1.5rem;
        }
        
        .explanation-card {
          background: var(--bg-primary, #0f0f1a);
          border-radius: 8px;
          padding: 1.5rem;
        }
        
        .section {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color, #333);
        }
        
        .section h5 {
          margin: 0 0 0.75rem 0;
          color: var(--text-secondary, #888);
          font-size: 0.875rem;
          text-transform: uppercase;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 1rem;
        }
        
        .metric-item {
          background: var(--bg-secondary, #1a1a2e);
          padding: 0.75rem;
          border-radius: 6px;
        }
        
        .metric-label {
          display: block;
          font-size: 0.75rem;
          color: var(--text-secondary, #888);
          text-transform: capitalize;
        }
        
        .metric-value {
          display: block;
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 0.25rem;
        }
        
        .loading-state, .error-state {
          text-align: center;
          padding: 2rem;
        }
        
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border-color, #333);
          border-top-color: var(--primary-color, #6366f1);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .timeline-container {
          position: relative;
          padding-left: 2rem;
        }
        
        .timeline-item {
          position: relative;
          padding: 1rem 0;
          border-left: 2px solid var(--border-color, #333);
          padding-left: 1.5rem;
        }
        
        .timeline-marker {
          position: absolute;
          left: -12px;
          width: 24px;
          height: 24px;
          background: var(--primary-color, #6366f1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 600;
        }
        
        .version-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .version-table td {
          padding: 0.5rem;
          border-bottom: 1px solid var(--border-color, #333);
        }
        
        .version-table code {
          background: var(--bg-secondary, #1a1a2e);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.875rem;
        }
        
        .raw-data {
          margin-top: 1rem;
        }
        
        .raw-data summary {
          cursor: pointer;
          color: var(--text-secondary, #888);
          padding: 0.5rem;
        }
        
        .raw-data pre {
          background: var(--bg-secondary, #1a1a2e);
          padding: 1rem;
          border-radius: 6px;
          overflow-x: auto;
          font-size: 0.75rem;
        }
        
        .flag-badge {
          display: inline-block;
          background: var(--warning-color, #f59e0b);
          color: black;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          margin-right: 0.5rem;
        }
        
        .confidence-badge {
          background: var(--bg-secondary, #1a1a2e);
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.875rem;
        }
        
        .trust-impact .positive {
          color: var(--success-color, #10b981);
        }
        
        .trust-impact .negative {
          color: var(--error-color, #ef4444);
        }
      `}</style>
        </div>
    );
};

export default ExplainabilityPanel;
