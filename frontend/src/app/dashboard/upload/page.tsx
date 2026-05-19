'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  Images,
  HardDrive,
  TrendingUp,
  TrendingDown,
  Calendar,
  RefreshCw,
  ImageIcon,
  Loader2,
  BarChart3,
  Clock,
} from 'lucide-react';
import { galleryApi, photoApi } from '@/lib/api';
import type { Gallery, Photo } from '@/types';
import { formatRelative } from '@/lib/utils';
import { cn } from '@/lib/utils';

// ─── Animations ───────────────────────────────────────────────────────────────

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function isThisWeek(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return date >= weekAgo;
}

function isLastWeek(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  return date >= twoWeeksAgo && date < weekAgo;
}

function isToday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadStats {
  totalPhotos: number;
  totalSize: number;
  thisWeek: number;
  lastWeek: number;
  today: number;
  totalGalleries: number;
  recentPhotos: Photo[];
  byGallery: { gallery: Gallery; count: number }[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const [stats, setStats] = useState<UploadStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      // Busca todas as galerias
      const galleriesRes = await galleryApi.list({ perPage: 100 });
      const galleries = Array.isArray(galleriesRes.data) ? galleriesRes.data : [];

      // Busca fotos de cada galeria em paralelo
      const photoResults = await Promise.allSettled(
        galleries.map((g) =>
          photoApi.list(g.id, { perPage: 200 }).then((r) => ({
            gallery: g,
            photos: Array.isArray(r.data) ? r.data : [],
          }))
        )
      );

      const allPhotos: Photo[] = [];
      const byGallery: { gallery: Gallery; count: number }[] = [];

      for (const result of photoResults) {
        if (result.status === 'fulfilled') {
          const { gallery, photos } = result.value;
          allPhotos.push(...photos);
          if (photos.length > 0) {
            byGallery.push({ gallery, count: photos.length });
          }
        }
      }

      // Ordena por mais fotos
      byGallery.sort((a, b) => b.count - a.count);

      // Fotos recentes (ordenadas por data)
      const recentPhotos = [...allPhotos]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8);

      const totalSize = allPhotos.reduce((acc, p) => acc + (p.size ?? 0), 0);

      setStats({
        totalPhotos: allPhotos.length,
        totalSize,
        thisWeek: allPhotos.filter((p) => isThisWeek(p.createdAt)).length,
        lastWeek: allPhotos.filter((p) => isLastWeek(p.createdAt)).length,
        today: allPhotos.filter((p) => isToday(p.createdAt)).length,
        totalGalleries: galleries.length,
        recentPhotos,
        byGallery: byGallery.slice(0, 6),
      });
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Erro ao carregar métricas de upload:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const weekTrend =
    stats && stats.lastWeek > 0
      ? Math.round(((stats.thisWeek - stats.lastWeek) / stats.lastWeek) * 100)
      : null;

  const statCards = stats
    ? [
        {
          label: 'Total de Fotos',
          value: stats.totalPhotos.toLocaleString('pt-BR'),
          icon: Images,
          trend: null,
          sub: `em ${stats.totalGalleries} galeria${stats.totalGalleries !== 1 ? 's' : ''}`,
        },
        {
          label: 'Esta semana',
          value: stats.thisWeek.toLocaleString('pt-BR'),
          icon: Calendar,
          trend: weekTrend,
          sub: `semana passada: ${stats.lastWeek}`,
        },
        {
          label: 'Hoje',
          value: stats.today.toLocaleString('pt-BR'),
          icon: Clock,
          trend: null,
          sub: 'uploads nas últimas 24h',
        },
        {
          label: 'Armazenamento',
          value: formatBytes(stats.totalSize),
          icon: HardDrive,
          trend: null,
          sub: 'total utilizado',
        },
      ]
    : [];

  return (
    <div className="p-6 lg:p-8 space-y-10 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-start justify-between"
      >
        <div>
          <p className="text-xs font-mono tracking-[0.3em] uppercase text-obsidian-500 mb-1">
            Administração
          </p>
          <h1 className="font-display text-4xl lg:text-5xl font-light text-obsidian-50">
            Uploads
            <span className="text-obsidian-500">.</span>
          </h1>
          <div className="gold-divider mt-3" />
        </div>

        <div className="flex items-center gap-3 mt-2">
          <p className="text-xs text-obsidian-500 hidden sm:block">
            Atualizado {formatRelative(lastUpdated.toISOString())}
          </p>
          <button
            onClick={loadStats}
            disabled={isLoading}
            className="btn-ghost gap-2 text-sm py-2"
          >
            <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
            Atualizar
          </button>
        </div>
      </motion.div>

      {/* ── Stat Cards ── */}
      {isLoading && !stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-4">
              <div className="w-9 h-9 skeleton rounded-xl" />
              <div className="space-y-2">
                <div className="h-7 w-16 skeleton rounded" />
                <div className="h-3 w-24 skeleton rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {statCards.map(({ label, value, icon: Icon, trend, sub }) => (
            <motion.div key={label} variants={item}>
              <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-obsidian-800 flex items-center justify-center">
                    <Icon size={17} className="text-gold-400" />
                  </div>
                  {trend !== null && trend !== undefined && (
                    <span
                      className={cn(
                        'flex items-center gap-1 text-xs font-mono',
                        trend >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}
                    >
                      {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {trend >= 0 ? '+' : ''}{trend}%
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-2xl font-display font-light text-obsidian-50">{value}</p>
                  <p className="text-xs text-obsidian-500 mt-0.5">{label}</p>
                  {sub && <p className="text-[11px] text-obsidian-600 mt-1">{sub}</p>}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Uploads por galeria ── */}
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-2xl font-light text-obsidian-100">
              Por galeria
            </h2>
            <div className="gold-divider mt-2" />
          </div>

          <div className="card divide-y divide-obsidian-800">
            {isLoading && !stats ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className="h-4 w-4 skeleton rounded" />
                  <div className="flex-1 h-3 skeleton rounded" />
                  <div className="h-3 w-8 skeleton rounded" />
                </div>
              ))
            ) : stats?.byGallery.length === 0 ? (
              <div className="p-8 text-center text-obsidian-500 text-sm">
                Nenhum upload registrado
              </div>
            ) : (
              <>
                {stats?.byGallery.map(({ gallery, count }, idx) => {
                  const max = stats.byGallery[0]?.count ?? 1;
                  const pct = Math.round((count / max) * 100);
                  return (
                    <motion.div
                      key={gallery.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.06 }}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <span className="text-xs text-obsidian-600 w-4 text-right font-mono">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-obsidian-100 truncate">{gallery.name}</p>
                        <div className="mt-1.5 h-1 rounded-full bg-obsidian-800 overflow-hidden">
                          <motion.div
                            className="h-full bg-gold-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.7, delay: idx * 0.06 + 0.2, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-mono text-obsidian-300 shrink-0">{count}</span>
                    </motion.div>
                  );
                })}
              </>
            )}
          </div>
        </section>

        {/* ── Fotos recentes ── */}
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-2xl font-light text-obsidian-100">
              Recém enviadas
            </h2>
            <div className="gold-divider mt-2" />
          </div>

          <div className="card divide-y divide-obsidian-800">
            {isLoading && !stats ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 skeleton rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 skeleton rounded" />
                    <div className="h-2.5 w-20 skeleton rounded" />
                  </div>
                </div>
              ))
            ) : stats?.recentPhotos.length === 0 ? (
              <div className="p-8 text-center text-obsidian-500 text-sm">
                Nenhuma foto enviada ainda
              </div>
            ) : (
              stats?.recentPhotos.map((photo, idx) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-lg bg-obsidian-800 overflow-hidden shrink-0 flex items-center justify-center">
                    {photo.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.thumbnailUrl}
                        alt={photo.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon size={14} className="text-obsidian-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-obsidian-200 truncate">{photo.filename}</p>
                    <p className="text-[11px] text-obsidian-500 mt-0.5">
                      {formatBytes(photo.size ?? 0)}
                    </p>
                  </div>

                  <span className="text-[11px] text-obsidian-500 shrink-0">
                    {formatRelative(photo.createdAt)}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ── Gráfico de barras semanal ── */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-light text-obsidian-100">
            Atividade semanal
          </h2>
          <div className="gold-divider mt-2" />
        </div>

        <WeeklyChart photos={stats?.recentPhotos ?? []} allPhotos={stats?.totalPhotos ?? 0} isLoading={isLoading && !stats} />
      </section>
    </div>
  );
}

// ─── Weekly Bar Chart ─────────────────────────────────────────────────────────

function WeeklyChart({
  photos,
  allPhotos,
  isLoading,
}: {
  photos: Photo[];
  allPhotos: number;
  isLoading: boolean;
}) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const now = new Date();

  // Conta fotos por dia da semana (últimos 7 dias)
  const counts = days.map((_, i) => {
    const target = new Date(now);
    target.setDate(now.getDate() - (6 - i));
    return photos.filter((p) => {
      const d = new Date(p.createdAt);
      return d.toDateString() === target.toDateString();
    }).length;
  });

  const max = Math.max(...counts, 1);
  const todayIdx = now.getDay(); // 0=Dom

  // Rearranjar para que hoje seja o último
  const reordered = days.map((_, i) => {
    const offset = (i - (6 - todayIdx) + 7) % 7;
    return { label: days[(todayIdx - 6 + i + 7) % 7], count: counts[i], isToday: offset === 6 };
  });

  return (
    <div className="card p-6">
      {isLoading ? (
        <div className="flex items-end gap-3 h-32">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 skeleton rounded-t-lg" style={{ height: `${20 + Math.random() * 60}%` }} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-end gap-2 sm:gap-3 h-36">
            {reordered.map(({ label, count, isToday: today }, i) => {
              const pct = max > 0 ? (count / max) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  {count > 0 && (
                    <span className="text-[10px] font-mono text-obsidian-500">{count}</span>
                  )}
                  <div className="w-full flex items-end" style={{ height: '100px' }}>
                    <motion.div
                      className={cn(
                        'w-full rounded-t-lg',
                        today ? 'bg-gold-500' : 'bg-obsidian-700'
                      )}
                      initial={{ height: 0 }}
                      animate={{ height: pct > 0 ? `${Math.max(pct, 4)}%` : '4px' }}
                      transition={{ duration: 0.6, delay: i * 0.07, ease: 'easeOut' }}
                      style={{ minHeight: '4px' }}
                    />
                  </div>
                  <span className={cn(
                    'text-[10px] font-mono',
                    today ? 'text-gold-400' : 'text-obsidian-600'
                  )}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-obsidian-800">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-gold-500" />
                <span className="text-xs text-obsidian-500">Hoje</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-obsidian-700" />
                <span className="text-xs text-obsidian-500">Outros dias</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-obsidian-500">
              <BarChart3 size={12} />
              <span>{allPhotos} fotos no total</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}