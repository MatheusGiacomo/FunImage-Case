'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, X } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

export default function TopBar() {
  // 1. Hooks de estado no topo
  const { user } = useAuthStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  // 2. Garante que o componente só renderize animações no cliente
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 3. Renderização de segurança (Skeleton) enquanto não monta
  if (!isMounted) {
    return (
      <header className="h-16 backdrop-blur-xl flex items-center px-6 shrink-0 sticky top-0 z-10"
        style={{ backgroundColor: 'var(--color-topbar)', borderBottom: '1px solid var(--color-topbar-border)' }} />
    );
  }

  return (
    <header className="h-16 backdrop-blur-xl flex items-center px-6 gap-4 shrink-0 sticky top-0 z-10"
      style={{ backgroundColor: 'var(--color-topbar)', borderBottom: '1px solid var(--color-topbar-border)' }}>
      
      {/* ── Search ── */}
      <div className="flex-1 flex items-center">
        <AnimatePresence initial={false} mode="wait">
          {searchOpen ? (
            <motion.div
              key="search-open"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: '100%', maxWidth: 480 }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="relative"
            >
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-text-muted)' }}
              />
              <input
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
                onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X size={14} />
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="search-closed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 transition-colors text-sm"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Search size={16} />
              <span className="hidden sm:inline">Buscar…</span>
              <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
                style={{ border: '1px solid var(--color-card-border)', color: 'var(--color-text-muted)' }}>
                ⌘K
              </kbd>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-2">
        {/* Notificações */}
        <button
          className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 hover:bg-[var(--color-hover)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <Bell size={17} />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-gold-500 border-2"
            style={{ borderColor: 'var(--color-topbar)' }} />
        </button>

        {/* Divider */}
        <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--color-divider)' }} />

        {/* Avatar */}
        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-8 h-8 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center shrink-0">
            <span className="text-gold-500 text-xs font-bold uppercase">
              {user?.name?.charAt(0) ?? 'U'}
            </span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium leading-none truncate max-w-[120px]"
              style={{ color: 'var(--color-text-primary)' }}>
              {user?.name?.split(' ')[0] ?? 'Usuário'}
            </p>
            <p className="text-[10px] mt-1 font-mono uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)' }}>
              {user?.role === 'admin' ? 'Admin' : 'Cliente'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}