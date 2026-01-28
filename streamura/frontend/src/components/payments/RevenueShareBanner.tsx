import React from 'react';

interface RevenueShareBannerProps {
    variant?: 'full' | 'compact' | 'minimal';
    showComparison?: boolean;
    className?: string;
}

export const RevenueShareBanner: React.FC<RevenueShareBannerProps> = ({
    variant = 'full',
    showComparison = true,
    className = '',
}) => {
    if (variant === 'minimal') {
        return (
            <div className={`revenue-banner minimal ${className}`}>
                <span className="highlight">90%</span> of earnings go to you
                <style>{`
          .revenue-banner.minimal {
            font-size: 0.875rem;
            color: var(--text-secondary, #888);
          }
          .revenue-banner.minimal .highlight {
            color: var(--success-color, #10b981);
            font-weight: 700;
          }
        `}</style>
            </div>
        );
    }

    if (variant === 'compact') {
        return (
            <div className={`revenue-banner compact ${className}`}>
                <div className="split-bar">
                    <div className="creator-share" style={{ width: '90%' }}>
                        <span className="percentage">90%</span>
                    </div>
                    <div className="platform-share" style={{ width: '10%' }}>
                        <span className="percentage">10%</span>
                    </div>
                </div>
                <div className="labels">
                    <span className="you-keep">You keep 90%</span>
                    <span className="platform">Platform fee</span>
                </div>
                <style>{`
          .revenue-banner.compact {
            background: var(--bg-secondary, #1a1a2e);
            border-radius: 12px;
            padding: 1rem;
          }
          .revenue-banner.compact .split-bar {
            display: flex;
            height: 8px;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 0.5rem;
          }
          .revenue-banner.compact .creator-share {
            background: linear-gradient(90deg, #10b981, #34d399);
          }
          .revenue-banner.compact .platform-share {
            background: var(--border-color, #333);
          }
          .revenue-banner.compact .percentage {
            display: none;
          }
          .revenue-banner.compact .labels {
            display: flex;
            justify-content: space-between;
            font-size: 0.875rem;
          }
          .revenue-banner.compact .you-keep {
            color: var(--success-color, #10b981);
            font-weight: 600;
          }
          .revenue-banner.compact .platform {
            color: var(--text-secondary, #888);
          }
        `}</style>
            </div>
        );
    }

    // Full variant
    return (
        <div className={`revenue-banner full ${className}`}>
            <div className="banner-content">
                <div className="split-visual">
                    <div className="creator-section">
                        <div className="percentage-display">
                            <span className="big-number">90</span>
                            <span className="percent">%</span>
                        </div>
                        <span className="label">You Keep</span>
                    </div>
                    <div className="divider">
                        <div className="divider-line" />
                    </div>
                    <div className="platform-section">
                        <div className="percentage-display small">
                            <span className="big-number">10</span>
                            <span className="percent">%</span>
                        </div>
                        <span className="label">Platform</span>
                    </div>
                </div>

                {showComparison && (
                    <div className="comparison">
                        <div className="comparison-header">
                            <span className="icon">💰</span>
                            <span>Industry's Best Creator Split</span>
                        </div>
                        <div className="competitors">
                            <div className="competitor">
                                <span className="name">Twitch</span>
                                <div className="bar-container">
                                    <div className="bar twitch" style={{ width: '50%' }} />
                                    <span className="rate">50%</span>
                                </div>
                            </div>
                            <div className="competitor">
                                <span className="name">YouTube</span>
                                <div className="bar-container">
                                    <div className="bar youtube" style={{ width: '55%' }} />
                                    <span className="rate">55%</span>
                                </div>
                            </div>
                            <div className="competitor highlight">
                                <span className="name">Streamura</span>
                                <div className="bar-container">
                                    <div className="bar streamura" style={{ width: '90%' }} />
                                    <span className="rate">90%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
        .revenue-banner.full {
          background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%);
          border: 1px solid var(--border-color, #333);
          border-radius: 16px;
          padding: 1.5rem;
          overflow: hidden;
        }

        .split-visual {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2rem;
          padding: 1.5rem 0;
        }

        .creator-section,
        .platform-section {
          text-align: center;
        }

        .percentage-display {
          display: flex;
          align-items: flex-start;
          justify-content: center;
        }

        .percentage-display .big-number {
          font-size: 4rem;
          font-weight: 800;
          line-height: 1;
          background: linear-gradient(135deg, #10b981, #34d399);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .percentage-display.small .big-number {
          font-size: 2rem;
          background: linear-gradient(135deg, #666, #888);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .percentage-display .percent {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 0.25rem;
          color: var(--text-secondary, #888);
        }

        .creator-section .label {
          display: block;
          margin-top: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          color: var(--success-color, #10b981);
        }

        .platform-section .label {
          display: block;
          margin-top: 0.25rem;
          font-size: 0.875rem;
          color: var(--text-secondary, #888);
        }

        .divider {
          height: 80px;
          display: flex;
          align-items: center;
        }

        .divider-line {
          width: 1px;
          height: 100%;
          background: linear-gradient(180deg, transparent, var(--border-color, #333), transparent);
        }

        .comparison {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border-color, #333);
        }

        .comparison-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
          font-size: 0.875rem;
          color: var(--text-secondary, #888);
        }

        .competitors {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .competitor {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .competitor .name {
          width: 80px;
          font-size: 0.875rem;
          color: var(--text-secondary, #888);
        }

        .competitor.highlight .name {
          color: var(--success-color, #10b981);
          font-weight: 600;
        }

        .bar-container {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .bar {
          height: 8px;
          border-radius: 4px;
        }

        .bar.twitch {
          background: #9146ff;
        }

        .bar.youtube {
          background: #ff0000;
        }

        .bar.streamura {
          background: linear-gradient(90deg, #10b981, #34d399);
        }

        .rate {
          font-size: 0.75rem;
          font-weight: 600;
          min-width: 35px;
        }

        .competitor.highlight .rate {
          color: var(--success-color, #10b981);
        }

        @media (max-width: 480px) {
          .split-visual {
            flex-direction: column;
            gap: 1rem;
          }
          
          .divider {
            width: 100%;
            height: 1px;
          }
          
          .divider-line {
            width: 100%;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--border-color, #333), transparent);
          }
          
          .percentage-display .big-number {
            font-size: 3rem;
          }
        }
      `}</style>
        </div>
    );
};

export default RevenueShareBanner;
