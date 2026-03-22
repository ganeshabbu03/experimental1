/**
 * MarketplacePage.tsx
 * --------------------
 * Premium full-page layout for the Deexen Plugin Marketplace.
 * Wraps the ExtensionList content area with a gradient header,
 * a stats banner, and back navigation.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, Package, ShoppingBag, Puzzle } from 'lucide-react';
import { ExtensionList } from '@/components/marketplace/ExtensionList';
import { usePluginStore } from '@/stores/usePluginStore';

export default function MarketplacePage() {
    const { installedPlugins } = usePluginStore();

    return (
        <div className="mkt-page">
            {/* ── Header ── */}
            <header className="mkt-header">
                <div className="mkt-header__inner">
                    <Link to="/dashboard" className="mkt-back-btn" aria-label="Back to dashboard">
                        <ArrowLeft size={18} />
                        <span>Dashboard</span>
                    </Link>

                    <div className="mkt-header__brand">
                        <div className="mkt-header__logo">
                            <Puzzle size={28} />
                        </div>
                        <div>
                            <h1 className="mkt-header__title">Plugin Marketplace</h1>
                            <p className="mkt-header__subtitle">
                                Powered by&nbsp;
                                <a
                                    href="https://open-vsx.org"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mkt-header__link"
                                >
                                    Open VSX Registry
                                </a>
                            </p>
                        </div>
                    </div>

                    {/* Stat badges */}
                    <div className="mkt-header__stats">
                        <div className="mkt-stat">
                            <ShoppingBag size={14} />
                            <span>Thousands of extensions</span>
                        </div>
                        <div className="mkt-stat mkt-stat--installed">
                            <Package size={14} />
                            <span>{installedPlugins.length} installed</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Main content ── */}
            <main className="mkt-main">
                <ExtensionList />
            </main>
        </div>
    );
}
