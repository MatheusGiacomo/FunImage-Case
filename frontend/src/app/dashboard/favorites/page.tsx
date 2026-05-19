'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, Images, ArrowRight, Loader2, ZoomIn, Download, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFavoritesStore } from '@/store/favorites.store';
import { useGalleryStore } from '@/store/gallery.store';
import { photoApi, downloadFile } from '@/lib/api';
import PhotoLightbox from '@/components/gallery/PhotoLightbox';
import { cn } from '@/lib/utils';
import type { Photo } from '@/types';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, scale: 0.95 },
  show:   { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit:   { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
};

interface GalleryGroup {
  galleryId: string;
  galleryName: string;
  photos: Photo[];
}

function groupByGallery(photos: Photo[]): GalleryGroup[] {
  const map = new Map<string, GalleryGroup>();
  for (const photo of photos) {
    const gid = photo.galleryId;
    if (!map.has(gid)) {
      map.set(gid, {
        galleryId: gid,
        galleryName: (photo as Photo & { galleryName?: string }).galleryName ?? 'Galeria',
        photos: [],
      });
    }
    map.get(gid)!.photos.push(photo);
  }
  return Array.from(map.values());
}

export default function FavoritesPage() {
  const { photos, total, hasNextPage, isLoading, isFetchingMore, fetchFavorites, fetchMore, removeFromFavorites } = useFavoritesStore();
  const { openModal, modal, closeModal } = useGalleryStore();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchFavorites(true); }, [fetchFavorites]);

  const handleIntersect = useCallback(
    ([entry]: IntersectionObserverEntry[]) => { if (entry.isIntersecting) fetchMore(); },
    [fetchMore]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(handleIntersect, { rootMargin: '400px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [handleIntersect]);

  const groups = groupByGallery(photos);

  return (
    <div className="p-6 lg:p-8 space-y-10 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <p className="text-xs font-mono tracking-[0.3em] uppercase text-obsidian-500 mb-1">Sua coleção</p>
        <h1 className="font-display text-4xl lg:text-5xl font-light text-obsidian-50 flex items-end gap-3">
          Favoritos
          {total > 0 && !isLoading && <span className="text-xl text-obsidian-500 font-sans mb-1">{total}</span>}
        </h1>
        <div className="gold-divider mt-3" />
      </motion.div>

      {isLoading ? (
        <FavoritesSkeletonGrid />
      ) : photos.length === 0 ? (
        <EmptyFavorites />
      ) : (
        <>
          {groups.map((group, gi) => (
            <motion.section
              key={group.galleryId}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: gi * 0.07 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gold-500/10 flex items-center justify-center">
                    <FolderOpen size={14} className="text-gold-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-obsidian-100">{group.galleryName}</h2>
                    <p className="text-xs text-obsidian-500">
                      {group.photos.length} {group.photos.length === 1 ? 'foto favorita' : 'fotos favoritas'}
                    </p>
                  </div>
                </div>
                <Link href={`/dashboard/gallery/${group.galleryId}`} className="text-xs text-obsidian-500 hover:text-gold-400 transition-colors flex items-center gap-1">
                  Ver álbum <ArrowRight size={11} />
                </Link>
              </div>

              <AnimatePresence>
                <motion.div variants={container} initial="hidden" animate="show" className="photo-grid">
                  {group.photos.map((photo, index) => (
                    <motion.div key={photo.id} variants={item} exit="exit" layout className="photo-grid-item">
                      <FavoritePhotoCard
                        photo={photo}
                        onUnfavorite={() => removeFromFavorites(photo.id)}
                        onOpen={() => {
                          useGalleryStore.setState({ photos: group.photos });
                          openModal(index);
                        }}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>

              {gi < groups.length - 1 && <div className="h-px bg-obsidian-800 mt-8" />}
            </motion.section>
          ))}

          <div ref={sentinelRef} className="h-4" />
          {isFetchingMore && (
            <div className="flex justify-center py-8">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-gold-500"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <PhotoLightbox isOpen={modal.isOpen} photos={modal.photos} currentIndex={modal.photoIndex ?? 0} onClose={closeModal} />
    </div>
  );
}

function FavoritePhotoCard({ photo, onUnfavorite, onOpen }: { photo: Photo; onUnfavorite: () => void; onOpen: () => void }) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const src = photo.watermarkedUrl || photo.thumbnailUrl;
  const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 1;

  const handleUnfavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRemoving(true);
    try {
      await photoApi.toggleFavorite(photo.id);
      onUnfavorite();
      toast.success('Removido dos favoritos');
    } catch {
      toast.error('Erro ao atualizar favorito');
      setIsRemoving(false);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!photo.isPurchased) { toast.error('É necessário adquirir a foto para fazer o download'); return; }
    setIsDownloading(true);
    try {
      const { url, filename } = await photoApi.getDownloadUrl(photo.id);
      await downloadFile(url, filename);
      toast.success('Download iniciado!');
    } catch {
      toast.error('Erro ao iniciar download');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="group relative overflow-hidden rounded-xl bg-obsidian-800 cursor-zoom-in"
      style={{ aspectRatio: Math.min(Math.max(aspectRatio, 0.5), 2) }}
      onClick={onOpen}
    >
      {/* Shimmer while loading */}
      {!imgLoaded && src && (
        <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-obsidian-800 via-obsidian-700/50 to-obsidian-800 bg-[length:400%_100%]" />
      )}

      {src && (
        <Image
          src={src}
          alt={photo.filename}
          fill
          className={cn('object-cover transition-all duration-500 group-hover:scale-[1.03]', imgLoaded ? 'opacity-100' : 'opacity-0')}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          onLoad={() => setImgLoaded(true)}
        />
      )}

      <div className="absolute inset-0 bg-obsidian-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-between p-3">
        <Link href={`/dashboard/gallery/${photo.galleryId}`} onClick={(e) => e.stopPropagation()} className="text-2xs font-mono text-obsidian-400 hover:text-gold-400 transition-colors truncate max-w-[60%]">
          Ver galeria →
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={handleDownload} disabled={isDownloading} className="w-8 h-8 rounded-lg bg-obsidian-800/80 backdrop-blur-sm flex items-center justify-center text-obsidian-300 hover:text-gold-400 transition-colors">
            {isDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onOpen(); }} className="w-8 h-8 rounded-lg bg-obsidian-800/80 backdrop-blur-sm flex items-center justify-center text-obsidian-300 hover:text-obsidian-100 transition-colors">
            <ZoomIn size={13} />
          </button>
          <button onClick={handleUnfavorite} disabled={isRemoving} className="w-8 h-8 rounded-lg bg-red-500/20 backdrop-blur-sm flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-colors">
            {isRemoving ? <Loader2 size={13} className="animate-spin" /> : <Heart size={13} className="fill-current" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyFavorites() {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col items-center justify-center py-32 text-center gap-5">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-obsidian-800 flex items-center justify-center">
          <Heart size={32} className="text-obsidian-600" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-obsidian-900 flex items-center justify-center">
          <span className="text-obsidian-600 text-xs">0</span>
        </div>
      </div>
      <div>
        <p className="font-display text-2xl font-light text-obsidian-400">Nenhum favorito ainda</p>
        <p className="text-sm text-obsidian-600 mt-1 max-w-xs">Clique no ❤ em qualquer foto para adicioná-la aqui</p>
      </div>
      <Link href="/dashboard/galleries" className="btn-ghost flex items-center gap-2 text-sm">
        <Images size={15} /> Ver galerias <ArrowRight size={13} />
      </Link>
    </motion.div>
  );
}

function FavoritesSkeletonGrid() {
  const heights = [200, 280, 180, 240, 200, 260, 220, 300, 180, 240, 200, 280];
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="skeleton w-7 h-7 rounded-lg" />
          <div className="space-y-1.5">
            <div className="skeleton h-3.5 w-32 rounded" />
            <div className="skeleton h-2.5 w-20 rounded" />
          </div>
        </div>
        <div className="photo-grid">
          {heights.map((h, i) => (
            <div key={i} className="photo-grid-item">
              <div className="skeleton rounded-xl" style={{ height: h }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}