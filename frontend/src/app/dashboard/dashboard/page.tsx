'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
  Images, Download, Heart, FolderOpen,
  ArrowRight, TrendingUp, Loader2, Clock,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useGalleryStore } from '@/store/gallery.store';
import GalleryCard from '@/components/gallery/GalleryCard';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { dashboardApi } from '@/lib/api';
import { formatRelative } from '@/lib/utils';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const iconMap: Record<string, React.ElementType> = {
  images: Images,
  folder: FolderOpen,
  download: Download,
  heart: Heart,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatCard {
  key: string;
  label: string;
  value: number | string;
  sub: string;
  icon: string;
  trend: string | null;
}

interface RecentPhoto {
  id: string;
  filename: string;
  galleryId: string;
  thumbnailUrl: string | null;
  width: number;
  height: number;
  createdAt: string;
}

interface DashboardData {
  role: 'admin' | 'client';
  stats: StatCard[];
  recentGalleries: unknown[];
  recentPhotos?: RecentPhoto[];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getStats()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Usuário';

  return (
    <div className="p-6 lg:p-8 space-y-10 max-w-7xl mx-auto">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <p className="text-xs font-mono tracking-[0.3em] uppercase text-obsidian-500 mb-1">
          Bem-vindo de volta
        </p>
        <h1 className="font-display text-4xl lg:text-5xl font-light text-obsidian-50">
          {firstName}<span className="text-obsidian-500">.</span>
        </h1>
      </motion.div>

      {/* Stats grid */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <motion.div key={i} variants={item}>
                <div className="card p-5 space-y-4">
                  <div className="skeleton w-9 h-9 rounded-xl" />
                  <div className="space-y-2">
                    <div className="skeleton h-7 w-12 rounded" />
                    <div className="skeleton h-3 w-20 rounded" />
                  </div>
                </div>
              </motion.div>
            ))
          : (data?.stats ?? []).map((stat) => {
              const Icon = iconMap[stat.icon] ?? Images;
              return (
                <motion.div key={stat.key} variants={item}>
                  <div className="card p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-obsidian-800 flex items-center justify-center">
                        <Icon size={17} className="text-gold-400" />
                      </div>
                      {stat.trend && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
                          <TrendingUp size={11} />
                          {stat.trend}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-2xl font-display font-light text-obsidian-50">
                        {stat.value}
                      </p>
                      <p className="text-xs text-obsidian-500 mt-0.5">{stat.label}</p>
                      <p className="text-2xs text-obsidian-600 mt-0.5">{stat.sub}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
      </motion.div>

      {/* Client only: recently added photos */}
      {!loading && data?.role === 'client' && (data.recentPhotos?.length ?? 0) > 0 && (
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-light text-obsidian-100">Fotos recentes</h2>
              <div className="gold-divider mt-2" />
            </div>
          </div>
          <motion.div
            variants={container} initial="hidden" animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
          >
            {(data.recentPhotos ?? []).map((photo) => (
              <motion.div key={photo.id} variants={item}>
                <Link href={`/dashboard/gallery/${photo.galleryId}`}>
                  <div className="group relative aspect-square rounded-xl overflow-hidden bg-obsidian-800 cursor-pointer">
                    {photo.thumbnailUrl ? (
                      <Image
                        src={photo.thumbnailUrl}
                        alt={photo.filename}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                      />
                    ) : (
                      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-obsidian-800 via-obsidian-700/50 to-obsidian-800 bg-[length:400%_100%]" />
                    )}
                    <div className="absolute inset-0 bg-obsidian-950/0 group-hover:bg-obsidian-950/40 transition-colors duration-200 flex items-end p-2">
                      <span className="text-2xs text-obsidian-300 opacity-0 group-hover:opacity-100 transition-opacity truncate w-full">
                        {formatRelative(photo.createdAt)}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* Recent galleries */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-light text-obsidian-100">
              {data?.role === 'admin' ? 'Galerias recentes' : 'Seus álbuns'}
            </h2>
            <div className="gold-divider mt-2" />
          </div>
          <Link
            href="/dashboard/galleries"
            className="flex items-center gap-1.5 text-sm text-obsidian-500 hover:text-gold-400 transition-colors"
          >
            Ver todas <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (data?.recentGalleries?.length ?? 0) === 0 ? (
          <EmptyGalleries />
        ) : (
          <motion.div
            variants={container} initial="hidden" animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {(data?.recentGalleries ?? []).map((gallery: unknown) => (
              <motion.div key={(gallery as { id: string }).id} variants={item}>
                <GalleryCard gallery={gallery as never} />
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
      <p className="font-display text-xl font-light text-obsidian-400">Nenhuma galeria ainda</p>
      <p className="text-sm text-obsidian-600 mt-1">
        Suas galerias aparecerão aqui quando forem criadas
      </p>
    </div>
  );
}