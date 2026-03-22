/**
 * ExtensionList.tsx
 * ------------------
 * Main content component for the Plugin Marketplace.
 *
 * Features:
 * - Auto-loads a "Trending" section on mount (popular Python/JS tools)
 * - Debounced search (800 ms) to avoid hammering the backend
 * - Category filter pills (All, Languages, Themes, Snippets, Linters, Formatters)
 * - Paginated results (18 per page)
 * - Loading / empty states
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { extensionService, type OpenVSXExtension } from '@/services/extensionService';
import { ExtensionCard } from './ExtensionCard';
import { Search, Loader2, ChevronLeft, ChevronRight, TrendingUp, Box } from 'lucide-react';

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CATEGORIES = [
    { label: 'All', value: '' },
    { label: 'Languages', value: 'Programming Languages' },
    { label: 'Themes', value: 'Themes' },
    { label: 'Snippets', value: 'Snippets' },
    { label: 'Linters', value: 'Linters' },
    { label: 'Formatters', value: 'Formatters' },
    { label: 'Keymaps', value: 'Keymaps' },
    { label: 'Debuggers', value: 'Debuggers' },
];

const PAGE_SIZE = 18;
// Popular queries used for the auto-loaded trending section
const TRENDING_QUERY = 'python';
const TRENDING_SIZE = 6;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExtensionList() {
    // Search state
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('');
    const [offset, setOffset] = useState(0);
    const [totalSize, setTotalSize] = useState(0);

    // Data
    const [extensions, setExtensions] = useState<OpenVSXExtension[]>([]);
    const [trending, setTrending] = useState<OpenVSXExtension[]>([]);

    // UI state
    const [loading, setLoading] = useState(false);
    const [trendingLoading, setTrendingLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Store the latest debounce timer so we can cancel it on re-type
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // -----------------------------------------------------------------------
    // Load trending on mount
    // -----------------------------------------------------------------------
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const result = await extensionService.searchExtensions(TRENDING_QUERY, 0, TRENDING_SIZE);
                if (!cancelled) setTrending(result.extensions ?? []);
            } catch {
                // Trending is best-effort — silent failure
            } finally {
                if (!cancelled) setTrendingLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // -----------------------------------------------------------------------
    // Main search fetch
    // -----------------------------------------------------------------------
    const fetchExtensions = useCallback(
        async (q: string, cat: string, off: number) => {
            setLoading(true);
            setError(null);
            try {
                const result = await extensionService.searchExtensions(q, off, PAGE_SIZE, cat);
                setExtensions(result.extensions ?? []);
                setTotalSize(result.totalSize ?? 0);
            } catch {
                setError('Failed to load extensions. Is the backend running?');
                setExtensions([]);
            } finally {
                setLoading(false);
            }
        },
        []
    );

    // Initial load on mount
    useEffect(() => {
        fetchExtensions('', '', 0);
    }, [fetchExtensions]);

    // -----------------------------------------------------------------------
    // Debounced search — fires 800 ms after the user stops typing
    // -----------------------------------------------------------------------
    const handleQueryChange = (value: string) => {
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setOffset(0);
            fetchExtensions(value, category, 0);
        }, 800);
    };

    // -----------------------------------------------------------------------
    // Category filter — instant (no debounce needed)
    // -----------------------------------------------------------------------
    const handleCategoryChange = (cat: string) => {
        setCategory(cat);
        setOffset(0);
        fetchExtensions(query, cat, 0);
    };

    // -----------------------------------------------------------------------
    // Pagination
    // -----------------------------------------------------------------------
    const handlePrev = () => {
        const newOffset = Math.max(0, offset - PAGE_SIZE);
        setOffset(newOffset);
        fetchExtensions(query, category, newOffset);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleNext = () => {
        const newOffset = offset + PAGE_SIZE;
        if (newOffset >= totalSize) return;
        setOffset(newOffset);
        fetchExtensions(query, category, newOffset);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
    const totalPages = Math.max(1, Math.ceil(totalSize / PAGE_SIZE));

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    return (
        <div className="mkt-container">
            {/* ── Search bar ── */}
            <div className="mkt-search-row">
                <div className="mkt-search-wrap">
                    <Search className="mkt-search-icon" size={16} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => handleQueryChange(e.target.value)}
                        placeholder="Search extensions…"
                        className="mkt-search-input"
                        aria-label="Search extensions"
                    />
                    {loading && <Loader2 className="mkt-search-spinner animate-spin" size={16} />}
                </div>
            </div>

            {/* ── Category pills ── */}
            <div className="mkt-categories">
                {CATEGORIES.map((c) => (
                    <button
                        key={c.value}
                        onClick={() => handleCategoryChange(c.value)}
                        className={`mkt-cat-pill${category === c.value ? ' mkt-cat-pill--active' : ''}`}
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            {/* ── Trending section (only shown when no active search) ── */}
            {!query && !category && (
                <section className="mkt-section">
                    <h2 className="mkt-section__title">
                        <TrendingUp size={18} className="mkt-section__icon" />
                        Trending Now
                    </h2>
                    {trendingLoading ? (
                        <div className="mkt-spinner-row">
                            <Loader2 className="animate-spin" size={24} />
                        </div>
                    ) : (
                        <div className="mkt-grid">
                            {trending.map((ext) => (
                                <ExtensionCard
                                    key={`${ext.namespace}.${ext.name}`}
                                    extension={ext}
                                    isTrending
                                />
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* ── Main results ── */}
            <section className="mkt-section">
                <h2 className="mkt-section__title">
                    {query
                        ? `Results for "${query}"`
                        : category
                            ? category
                            : 'All Extensions'}
                    {!loading && totalSize > 0 && (
                        <span className="mkt-section__count">{totalSize.toLocaleString()} extensions</span>
                    )}
                </h2>

                {error && (
                    <div className="mkt-error">{error}</div>
                )}

                {loading ? (
                    <div className="mkt-spinner-row">
                        <Loader2 className="animate-spin" size={28} />
                    </div>
                ) : extensions.length === 0 ? (
                    <div className="mkt-empty">
                        <Box size={40} />
                        <p>No extensions found. Try a different search term.</p>
                    </div>
                ) : (
                    <div className="mkt-grid">
                        {extensions.map((ext) => (
                            <ExtensionCard
                                key={`${ext.namespace}.${ext.name}`}
                                extension={ext}
                            />
                        ))}
                    </div>
                )}

                {/* ── Pagination ── */}
                {totalPages > 1 && (
                    <div className="mkt-pagination">
                        <button
                            onClick={handlePrev}
                            disabled={offset === 0}
                            className="mkt-page-btn"
                            aria-label="Previous page"
                        >
                            <ChevronLeft size={16} />
                            Prev
                        </button>
                        <span className="mkt-page-info">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={handleNext}
                            disabled={offset + PAGE_SIZE >= totalSize}
                            className="mkt-page-btn"
                            aria-label="Next page"
                        >
                            Next
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
}

