import React, { useState, useEffect } from 'react';

interface BlockerItem {
    id: string;
    rule_name: string;
    category: string;
    severity: 'block' | 'warning' | 'info';
    title: string;
    message: string;
    impact: string;
    fix_action: string | null;
    fix_url: string | null;
    fix_time_estimate: string | null;
    priority?: number;
}

interface BlockersSummary {
    summary: {
        total_issues: number;
        blockers: number;
        warnings: number;
        info: number;
    };
    critical_blockers: BlockerItem[];
    warnings: BlockerItem[];
    quick_wins: BlockerItem[];
    categories: Record<string, number>;
}

interface BlockersUnlockersProps {
    className?: string;
}

const API_BASE = '/api/v1';

export const BlockersUnlockers: React.FC<BlockersUnlockersProps> = ({ className = '' }) => {
    const [data, setData] = useState<BlockersSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'blockers' | 'quick-wins'>('all');

    useEffect(() => {
        fetchBlockers();
    }, []);

    const fetchBlockers = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/users/me/blockers`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) throw new Error('Failed to fetch blockers');

            const result = await response.json();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'block': return '🚫';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
            default: return '•';
        }
    };

    const getSeverityClass = (severity: string) => {
        switch (severity) {
            case 'block': return 'severity-block';
            case 'warning': return 'severity-warning';
            case 'info': return 'severity-info';
            default: return '';
        }
    };

    const renderBlockerCard = (item: BlockerItem) => (
        <div key={item.id} className={`blocker-card ${getSeverityClass(item.severity)}`}>
            <div className="card-header">
                <span className="severity-icon">{getSeverityIcon(item.severity)}</span>
                <span className="title">{item.title}</span>
                {item.fix_time_estimate && (
                    <span className="time-badge">{item.fix_time_estimate}</span>
                )}
            </div>
            <p className="message">{item.message}</p>
            <div className="impact">
                <span className="label">Impact:</span> {item.impact}
            </div>
            {item.fix_action && (
                <div className="fix-section">
                    <span className="fix-action">{item.fix_action}</span>
                    {item.fix_url && (
                        <a href={item.fix_url} className="fix-button">
                            Fix Now →
                        </a>
                    )}
                </div>
            )}
        </div>
    );

    if (loading) {
        return (
            <div className={`blockers-dashboard loading ${className}`}>
                <div className="spinner" />
                <p>Loading your action items...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className={`blockers-dashboard error ${className}`}>
                <p>Failed to load blockers: {error}</p>
                <button onClick={fetchBlockers}>Try Again</button>
            </div>
        );
    }

    return (
        <div className={`blockers-dashboard ${className}`}>
            {/* Summary Header */}
            <div className="summary-header">
                <h2>🎯 Action Items</h2>
                <div className="summary-stats">
                    <div className="stat">
                        <span className="stat-value">{data.summary.total_issues}</span>
                        <span className="stat-label">Total</span>
                    </div>
                    <div className="stat blocker">
                        <span className="stat-value">{data.summary.blockers}</span>
                        <span className="stat-label">Blockers</span>
                    </div>
                    <div className="stat warning">
                        <span className="stat-value">{data.summary.warnings}</span>
                        <span className="stat-label">Warnings</span>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="tab-nav">
                <button
                    className={activeTab === 'all' ? 'active' : ''}
                    onClick={() => setActiveTab('all')}
                >
                    All Issues
                </button>
                <button
                    className={activeTab === 'blockers' ? 'active' : ''}
                    onClick={() => setActiveTab('blockers')}
                >
                    Blockers ({data.summary.blockers})
                </button>
                <button
                    className={activeTab === 'quick-wins' ? 'active' : ''}
                    onClick={() => setActiveTab('quick-wins')}
                >
                    🚀 Quick Wins
                </button>
            </div>

            {/* Content */}
            <div className="blockers-content">
                {activeTab === 'all' && (
                    <>
                        {data.critical_blockers.length > 0 && (
                            <section className="section">
                                <h3>🚫 Critical Blockers</h3>
                                <p className="section-desc">These issues must be resolved before you can continue.</p>
                                {data.critical_blockers.map(renderBlockerCard)}
                            </section>
                        )}

                        {data.warnings.length > 0 && (
                            <section className="section">
                                <h3>⚠️ Warnings</h3>
                                <p className="section-desc">Recommended fixes to improve your experience.</p>
                                {data.warnings.map(renderBlockerCard)}
                            </section>
                        )}

                        {data.summary.total_issues === 0 && (
                            <div className="all-clear">
                                <span className="icon">✅</span>
                                <h3>All Clear!</h3>
                                <p>You have no outstanding issues. Keep up the great work!</p>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'blockers' && (
                    <section className="section">
                        {data.critical_blockers.length > 0 ? (
                            data.critical_blockers.map(renderBlockerCard)
                        ) : (
                            <div className="all-clear">
                                <span className="icon">✅</span>
                                <h3>No Blockers</h3>
                                <p>You have no blocking issues preventing your progress.</p>
                            </div>
                        )}
                    </section>
                )}

                {activeTab === 'quick-wins' && (
                    <section className="section">
                        <p className="section-desc">
                            These are the fastest ways to improve your account status.
                        </p>
                        {data.quick_wins.length > 0 ? (
                            data.quick_wins.map(renderBlockerCard)
                        ) : (
                            <div className="all-clear">
                                <span className="icon">🎉</span>
                                <h3>No Quick Wins Available</h3>
                                <p>You've already addressed all the quick fixes!</p>
                            </div>
                        )}
                    </section>
                )}
            </div>

            {/* Category Breakdown */}
            {data.summary.total_issues > 0 && (
                <div className="category-breakdown">
                    <h4>Issues by Category</h4>
                    <div className="categories">
                        {Object.entries(data.categories)
                            .filter(([_, count]) => count > 0)
                            .map(([category, count]) => (
                                <div key={category} className="category-badge">
                                    <span className="category-name">{category}</span>
                                    <span className="category-count">{count}</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            <style>{`
        .blockers-dashboard {
          background: var(--bg-secondary, #1a1a2e);
          border-radius: 16px;
          padding: 1.5rem;
        }

        .blockers-dashboard.loading,
        .blockers-dashboard.error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 300px;
          text-align: center;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border-color, #333);
          border-top-color: var(--primary-color, #6366f1);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .summary-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .summary-header h2 {
          margin: 0;
          font-size: 1.5rem;
        }

        .summary-stats {
          display: flex;
          gap: 1rem;
        }

        .stat {
          background: var(--bg-primary, #0f0f1a);
          padding: 0.75rem 1rem;
          border-radius: 8px;
          text-align: center;
        }

        .stat.blocker {
          border-left: 3px solid var(--error-color, #ef4444);
        }

        .stat.warning {
          border-left: 3px solid var(--warning-color, #f59e0b);
        }

        .stat-value {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .stat-label {
          font-size: 0.75rem;
          color: var(--text-secondary, #888);
          text-transform: uppercase;
        }

        .tab-nav {
          display: flex;
          gap: 0.5rem;
          border-bottom: 1px solid var(--border-color, #333);
          padding-bottom: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .tab-nav button {
          background: transparent;
          border: none;
          color: var(--text-secondary, #888);
          padding: 0.5rem 1rem;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .tab-nav button:hover {
          background: var(--bg-hover, #252540);
        }

        .tab-nav button.active {
          background: var(--primary-color, #6366f1);
          color: white;
        }

        .section {
          margin-bottom: 2rem;
        }

        .section h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.125rem;
        }

        .section-desc {
          color: var(--text-secondary, #888);
          font-size: 0.875rem;
          margin-bottom: 1rem;
        }

        .blocker-card {
          background: var(--bg-primary, #0f0f1a);
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1rem;
          border-left: 4px solid transparent;
        }

        .blocker-card.severity-block {
          border-left-color: var(--error-color, #ef4444);
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), transparent);
        }

        .blocker-card.severity-warning {
          border-left-color: var(--warning-color, #f59e0b);
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), transparent);
        }

        .blocker-card.severity-info {
          border-left-color: var(--info-color, #3b82f6);
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), transparent);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .severity-icon {
          font-size: 1.25rem;
        }

        .title {
          font-weight: 600;
          flex: 1;
        }

        .time-badge {
          background: var(--bg-secondary, #1a1a2e);
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-size: 0.75rem;
          color: var(--text-secondary, #888);
        }

        .message {
          margin: 0 0 0.75rem 0;
          color: var(--text-primary, #fff);
        }

        .impact {
          font-size: 0.875rem;
          color: var(--text-secondary, #888);
          margin-bottom: 1rem;
        }

        .impact .label {
          font-weight: 500;
        }

        .fix-section {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--border-color, #333);
        }

        .fix-action {
          font-size: 0.875rem;
          color: var(--text-secondary, #888);
        }

        .fix-button {
          background: var(--primary-color, #6366f1);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.875rem;
          transition: opacity 0.2s;
        }

        .fix-button:hover {
          opacity: 0.9;
        }

        .all-clear {
          text-align: center;
          padding: 3rem;
        }

        .all-clear .icon {
          font-size: 3rem;
          display: block;
          margin-bottom: 1rem;
        }

        .all-clear h3 {
          margin: 0 0 0.5rem 0;
        }

        .all-clear p {
          color: var(--text-secondary, #888);
        }

        .category-breakdown {
          background: var(--bg-primary, #0f0f1a);
          border-radius: 12px;
          padding: 1rem 1.25rem;
          margin-top: 1.5rem;
        }

        .category-breakdown h4 {
          margin: 0 0 0.75rem 0;
          font-size: 0.875rem;
          color: var(--text-secondary, #888);
        }

        .categories {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .category-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--bg-secondary, #1a1a2e);
          padding: 0.5rem 0.75rem;
          border-radius: 20px;
          font-size: 0.875rem;
        }

        .category-name {
          text-transform: capitalize;
        }

        .category-count {
          background: var(--bg-hover, #252540);
          padding: 0.125rem 0.375rem;
          border-radius: 10px;
          font-size: 0.75rem;
          font-weight: 600;
        }
      `}</style>
        </div>
    );
};

export default BlockersUnlockers;
