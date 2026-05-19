'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Grid3X3, LayoutList, X } from 'lucide-react';
import { useGalleryStore } from '@/store/gallery.store';
import GalleryCard from '@/components/gallery/GalleryCard';
import SkeletonCard from '@/components/ui/SkeletonCard';
import CreateGalleryModal from '@/components/gallery/CreateGalleryModal';
import { cn } from '@/lib/utils';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export default function GalleriesPage() {
  const { galleries: galleriesRaw, isLoadingGalleries, fetchGalleries } = useGalleryStore();
  const galleries = Array.isArray(galleriesRaw) ? galleriesRaw : [];
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => { fetchGalleries(); }, [fetchGalleries]);

  const filtered = galleries.filter((g) =>
    (g?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono tracking-[0.3em] uppercase text-obsidian-500 mb-1">
            Biblioteca
          </p>
          <h1 className="font-display text-4xl font-light text-obsidian-50">
            Galerias
          </h1>
          <div className="gold-divider mt-2" />
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="btn-primary self-start sm:self-center gap-2"
        >
          <Plus size={16} />
          Nova galeria
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar galerias…"
            className="input pl-9 h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-obsidian-500 hover:text-obsidian-300"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Count */}
        <span className="text-sm text-obsidian-500 font-mono hidden sm:block">
          {filtered.length} {filtered.length === 1 ? 'galeria' : 'galerias'}
        </span>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-obsidian-800 rounded-xl p-1">
          <button
            onClick={() => setView('grid')}
            className={cn(
              'w-8 h-7 rounded-lg flex items-center justify-center transition-all duration-150',
              view === 'grid'
                ? 'bg-obsidian-600 text-obsidian-100'
                : 'text-obsidian-500 hover:text-obsidian-300'
            )}
          >
            <Grid3X3 size={14} />
          </button>
          <button
            onClick={() => setView('list')}
            className={cn(
              'w-8 h-7 rounded-lg flex items-center justify-center transition-all duration-150',
              view === 'list'
                ? 'bg-obsidian-600 text-obsidian-100'
                : 'text-obsidian-500 hover:text-obsidian-300'
            )}
          >
            <LayoutList size={14} />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      {isLoadingGalleries ? (
        <div className={cn(
          view === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
            : 'flex flex-col gap-3'
        )}>
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} compact={view === 'list'} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasSearch={!!search} onClear={() => setSearch('')} onCreate={() => setCreateOpen(true)} />
      ) : (
        <motion.div
          key={view}
          variants={container}
          initial="hidden"
          animate="show"
          className={cn(
            view === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
              : 'flex flex-col gap-3'
          )}
        >
          {filtered.map((gallery) => (
            <motion.div key={gallery.id} variants={item}>
              <GalleryCard gallery={gallery} compact={view === 'list'} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── Create Modal ── */}
      <CreateGalleryModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function EmptyState({
  hasSearch,
  onClear,
  onCreate,
}: {
  hasSearch: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
      <div className="w-20 h-20 rounded-2xl bg-obsidian-800 flex items-center justify-center">
        <Grid3X3 size={32} className="text-obsidian-600" />
      </div>
      {hasSearch ? (
        <>
          <p className="font-display text-2xl font-light text-obsidian-400">
            Nenhuma galeria encontrada
          </p>
          <button onClick={onClear} className="btn-ghost text-sm">
            Limpar busca
          </button>
        </>
      ) : (
        <>
          <p className="font-display text-2xl font-light text-obsidian-400">
            Nenhuma galeria ainda
          </p>
          <p className="text-sm text-obsidian-600 max-w-xs">
            Crie sua primeira galeria para começar a organizar as fotos
          </p>
          <button onClick={onCreate} className="btn-primary">
            <Plus size={16} />
            Criar galeria
          </button>
        </>
      )}
    </div>
  );
}