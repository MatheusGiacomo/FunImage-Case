'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, X, FolderOpen, ImageIcon, Loader2, Clock } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Gallery, Photo } from '@/types';
import NotificationBell from './NotificationBell';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SearchResults {
  galleries: Gallery[];
  photos: Photo[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SearchResultItem({
  icon,
  label,
  sublabel,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()} // prevents input blur before click
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 hover:bg-[var(--color-hover)]"
    >
      <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg"
        style={{ backgroundColor: 'var(--color-input-bg)', color: 'var(--color-text-secondary)' }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
          {label}
        </span>
        {sublabel && (
          <span className="block text-xs truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {sublabel}
          </span>
        )}
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--color-text-muted)' }}>
        {children}
      </span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TopBar() {
  const { user } = useAuthStore();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const debouncedQuery = useDebounce(searchQuery, 280);

  // Mount guard for SSR
  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = sessionStorage.getItem('fotopro:recent-searches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {}
  }, []);

  // ── Keyboard shortcut ⌘K / Ctrl+K ───────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        closeSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Fetch results when debounced query changes ───────────────────────
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults(null);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    apiClient
      .get<SearchResults>('/search/', { params: { q: debouncedQuery } })
      .then(({ data }) => {
        if (!cancelled) setResults(data as unknown as SearchResults);
      })
      .catch(() => {
        if (!cancelled) setResults({ galleries: [], photos: [] });
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // ── Close on outside click ───────────────────────────────────────────
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setResults(null);
  }, []);

  const saveRecent = useCallback((term: string) => {
    setRecentSearches(prev => {
      const next = [term, ...prev.filter(s => s !== term)].slice(0, 4);
      try { sessionStorage.setItem('fotopro:recent-searches', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const navigateToGallery = useCallback((galleryId: string) => {
    saveRecent(searchQuery);
    closeSearch();
    router.push(`/dashboard/gallery/${galleryId}`);
  }, [searchQuery, closeSearch, router, saveRecent]);

  const navigateToPhoto = useCallback((photo: Photo) => {
    saveRecent(searchQuery);
    closeSearch();
    router.push(`/dashboard/gallery/${photo.galleryId}`);
  }, [searchQuery, closeSearch, router, saveRecent]);

  const handleRecentClick = useCallback((term: string) => {
    setSearchQuery(term);
    inputRef.current?.focus();
  }, []);

  const hasResults = results && (results.galleries.length > 0 || results.photos.length > 0);
  const showEmpty = results && !hasResults && debouncedQuery.length >= 2 && !isSearching;
  const showDropdown = searchOpen && (
    isSearching ||
    hasResults ||
    showEmpty ||
    (!searchQuery && recentSearches.length > 0)
  );

  if (!isMounted) {
    return (
      <header
        className="h-16 backdrop-blur-xl flex items-center px-6 shrink-0 sticky top-0 z-10"
        style={{ backgroundColor: 'var(--color-topbar)', borderBottom: '1px solid var(--color-topbar-border)' }}
      />
    );
  }

  return (
    <header
      className="h-16 backdrop-blur-xl flex items-center px-6 gap-4 shrink-0 sticky top-0 z-20"
      style={{ backgroundColor: 'var(--color-topbar)', borderBottom: '1px solid var(--color-topbar-border)' }}
    >
      {/* ── Search ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center" ref={containerRef}>
        <AnimatePresence initial={false} mode="wait">
          {searchOpen ? (
            <motion.div
              key="search-open"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: '100%', maxWidth: 520 }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="relative"
            >
              {/* Input */}
              <div className="relative">
                {isSearching ? (
                  <Loader2
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin"
                    style={{ color: 'var(--color-text-muted)' }}
                  />
                ) : (
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--color-text-muted)' }}
                  />
                )}
                <input
                  ref={inputRef}
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar galerias, fotos…"
                  className="w-full rounded-xl pl-9 pr-10 py-2 text-sm h-9 focus:outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--color-input-bg)',
                    border: '1px solid var(--color-input-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
                <button
                  onClick={closeSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Dropdown */}
              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden py-2 z-50"
                    style={{
                      backgroundColor: 'var(--color-card)',
                      border: '1px solid var(--color-card-border)',
                      boxShadow: 'var(--shadow-card-hover)',
                    }}
                  >
                    {/* Recent searches */}
                    {!searchQuery && recentSearches.length > 0 && (
                      <>
                        <SectionLabel>Pesquisas recentes</SectionLabel>
                        {recentSearches.map((term) => (
                          <SearchResultItem
                            key={term}
                            icon={<Clock size={14} />}
                            label={term}
                            onClick={() => handleRecentClick(term)}
                          />
                        ))}
                      </>
                    )}

                    {/* Loading */}
                    {isSearching && (
                      <div className="flex items-center gap-2 px-4 py-3">
                        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Buscando…</span>
                      </div>
                    )}

                    {/* Gallery results */}
                    {!isSearching && results && results.galleries.length > 0 && (
                      <>
                        <SectionLabel>Galerias</SectionLabel>
                        {results.galleries.map((gallery) => (
                          <SearchResultItem
                            key={gallery.id}
                            icon={<FolderOpen size={14} />}
                            label={gallery.name}
                            sublabel={`${gallery.photoCount} foto${gallery.photoCount !== 1 ? 's' : ''}`}
                            onClick={() => navigateToGallery(gallery.id)}
                          />
                        ))}
                      </>
                    )}

                    {/* Photo results */}
                    {!isSearching && results && results.photos.length > 0 && (
                      <>
                        <SectionLabel>Fotos</SectionLabel>
                        {results.photos.map((photo) => (
                          <SearchResultItem
                            key={photo.id}
                            icon={<ImageIcon size={14} />}
                            label={photo.filename}
                            sublabel={photo.galleryName ?? 'Galeria'}
                            onClick={() => navigateToPhoto(photo)}
                          />
                        ))}
                      </>
                    )}

                    {/* Divider + see all */}
                    {!isSearching && hasResults && (
                      <>
                        <div className="mx-4 my-1.5" style={{ borderTop: '1px solid var(--color-divider)' }} />
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            saveRecent(searchQuery);
                            closeSearch();
                            router.push(`/dashboard/galleries?search=${encodeURIComponent(searchQuery)}`);
                          }}
                          className="w-full text-left px-4 py-2 text-xs transition-colors hover:bg-[var(--color-hover)]"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          Ver todos os resultados para <span className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>"{searchQuery}"</span> →
                        </button>
                      </>
                    )}

                    {/* Empty state */}
                    {showEmpty && (
                      <div className="px-4 py-4 text-center">
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          Nenhum resultado para <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>"{debouncedQuery}"</span>
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.button
              key="search-closed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSearchOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
              className="flex items-center gap-2 transition-colors text-sm"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Search size={16} />
              <span className="hidden sm:inline">Buscar…</span>
              <kbd
                className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
                style={{ border: '1px solid var(--color-card-border)', color: 'var(--color-text-muted)' }}
              >
                ⌘K
              </kbd>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <NotificationBell />

        <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--color-divider)' }} />

        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-8 h-8 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center shrink-0">
            <span className="text-gold-500 text-xs font-bold uppercase">
              {user?.name?.charAt(0) ?? 'U'}
            </span>
          </div>
          <div className="hidden md:block">
            <p
              className="text-sm font-medium leading-none truncate max-w-[120px]"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {user?.name?.split(' ')[0] ?? 'Usuário'}
            </p>
            <p
              className="text-[10px] mt-1 font-mono uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {user?.role === 'admin' ? 'Admin' : 'Cliente'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
