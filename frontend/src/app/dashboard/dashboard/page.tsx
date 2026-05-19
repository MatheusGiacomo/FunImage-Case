'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Images, Download, Heart, Clock, ArrowRight, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useGalleryStore } from '@/store/gallery.store';
import GalleryCard from '@/components/gallery/GalleryCard';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { formatRelative } from '@/lib/utils';

// ─── Stagger animation variants ──────────────────────────────────────────────

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Mock stats ──────────────────────────────────────────────────────────────

const stats = [
  { label: 'Total de Fotos',   value: '0',   icon: Images,    trend: null },
  { label: 'Downloads',        value: '0',   icon: Download,  trend: '+12%' },
  { label: 'Favoritos',        value: '0',   icon: Heart,     trend: null },
  { label: 'Última atualização', value: 'Hoje', icon: Clock,  trend: null },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { galleries: galleriesRaw, isLoadingGalleries, fetchGalleries } = useGalleryStore();
  const galleries = Array.isArray(galleriesRaw) ? galleriesRaw : [];

  useEffect(() => {
    fetchGalleries();
  }, [fetchGalleries]);

  const recentGalleries = galleries.slice(0, 4);

  return (
    <div className="p-6 lg:p-8 space-y-10 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-mono tracking-[0.3em] uppercase text-obsidian-500 mb-1">
          Bem-vindo de volta
        </p>
        <h1 className="font-display text-4xl lg:text-5xl font-light text-obsidian-50">
          {user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Usuário'}
          <span className="text-obsidian-500">.</span>
        </h1>
      </motion.div>

      {/* ── Stats grid ── */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map(({ label, value, icon: Icon, trend }) => (
          <motion.div key={label} variants={item}>
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-obsidian-800 flex items-center justify-center">
                  <Icon size={17} className="text-gold-400" />
                </div>
                {trend && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
                    <TrendingUp size={11} />
                    {trend}
                  </span>
                )}
              </div>
              <div>
                <p className="text-2xl font-display font-light text-obsidian-50">
                  {isLoadingGalleries && value === '0' ? (
                    <span className="inline-block w-8 h-6 skeleton rounded" />
                  ) : (
                    value
                  )}
                </p>
                <p className="text-xs text-obsidian-500 mt-0.5">{label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Recent galleries ── */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-light text-obsidian-100">
              Galerias recentes
            </h2>
            <div className="gold-divider mt-2" />
          </div>
          <Link
            href="/dashboard/galleries"
            className="flex items-center gap-1.5 text-sm text-obsidian-500 hover:text-gold-400 transition-colors"
          >
            Ver todas
            <ArrowRight size={14} />
          </Link>
        </div>

        {isLoadingGalleries ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : recentGalleries.length === 0 ? (
          <EmptyGalleries />
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {recentGalleries.map((gallery) => (
              <motion.div key={gallery.id} variants={item}>
                <GalleryCard gallery={gallery} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
}

function EmptyGalleries() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-obsidian-800 flex items-center justify-center mb-4">
        <Images size={28} className="text-obsidian-600" />
      </div>
      <p className="font-display text-xl font-light text-obsidian-400">
        Nenhuma galeria ainda
      </p>
      <p className="text-sm text-obsidian-600 mt-1">
        Suas galerias aparecerão aqui quando forem criadas
      </p>
    </div>
  );
}