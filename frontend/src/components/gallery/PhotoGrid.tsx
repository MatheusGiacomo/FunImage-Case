'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Heart, Download, ZoomIn, Loader2, Trash2, ShoppingBag } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { useGalleryStore } from '@/store/gallery.store';
import { useAuthStore } from '@/store/auth.store';
import { photoApi, downloadFile } from '@/lib/api';
import { cn } from '@/lib/utils';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PurchaseDialog, { type PurchaseTarget } from '@/components/ui/PurchaseDialog';
import toast from 'react-hot-toast';
import type { Photo } from '@/types';

interface PhotoGridProps {
  photos: Photo[];
  isLoading?: boolean;
}

export default function PhotoGrid({ photos, isLoading }: PhotoGridProps) {
  return (
    <div className="photo-grid">
      {photos.map((photo, index) => (
        <PhotoItem key={photo.id} photo={photo} index={index} />
      ))}

      {isLoading &&
        photos.length === 0 &&
        Array.from({ length: 12 }).map((_, i) => (
          <PhotoSkeleton key={`skeleton-${i}`} index={i} />
        ))}
    </div>
  );
}

// Foto Item
function PhotoItem({ photo, index }: { photo: Photo; index: number }) {
  const { openModal, toggleFavorite, deletePhoto } = useGalleryStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [isPurchased, setIsPurchased] = useState(photo.isPurchased ?? false);
  const [imgLoaded, setImgLoaded] = useState(false);
  // Local optimistic state so the heart stays filled immediately on click
  // and survives re-renders while the API call is in-flight.
  const [isFavorited, setIsFavorited] = useState(photo.isFavorited ?? false);

  // Sync when the store updates this photo's isFavorited from a fresh fetch
  useEffect(() => {
    setIsFavorited(photo.isFavorited ?? false);
  }, [photo.isFavorited]);

  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: '200px' });

  const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 1;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPurchased) {
      setShowPurchase(true);
      return;
    }
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

  const handlePurchaseSuccess = () => {
    setIsPurchased(true);
    setShowPurchase(false);
    // auto-download after unlock
    photoApi.getDownloadUrl(photo.id).then(({ url, filename }) => downloadFile(url, filename));
  };

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Optimistic toggle — update UI immediately before the API responds
    const next = !isFavorited;
    setIsFavorited(next);
    try {
      await toggleFavorite(photo.id);
    } catch {
      setIsFavorited(!next); // revert on error
      toast.error('Erro ao atualizar favorito');
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePhoto(photo.id);
      toast.success('Foto excluída');
      setShowDeleteConfirm(false);
    } catch {
      toast.error('Erro ao excluir foto');
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{
        duration: 0.4,
        delay: (index % 10) * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="photo-grid-item group relative cursor-zoom-in"
      onClick={() => openModal(index)}
    >
      {/* Image container */}
      <div
        className="relative overflow-hidden rounded-xl bg-obsidian-800"
        style={{ aspectRatio: Math.min(Math.max(aspectRatio, 0.5), 2) }}
      >
        {inView && (photo.watermarkedUrl || photo.thumbnailUrl) && (
          <>
            {/* Shimmer shown until image loads */}
            {!imgLoaded && (
              <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-obsidian-800 via-obsidian-700/50 to-obsidian-800 bg-[length:400%_100%]" />
            )}
            <Image
              src={photo.watermarkedUrl || photo.thumbnailUrl!}
              alt={photo.filename}
              fill
              className={cn(
                'object-cover transition-all duration-500',
                imgLoaded ? 'opacity-100' : 'opacity-0',
                'group-hover:scale-[1.03]',
                photo.status === 'processing' && 'blur-sm'
              )}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              onLoad={() => setImgLoaded(true)}
            />
          </>
        )}

        {/* Processing overlay — shown while Celery watermark task is pending/running */}
        {(photo.status === 'processing' || (photo.status === 'pending' && !photo.watermarkedUrl)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-obsidian-900/50">
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={20} className="text-gold-400 animate-spin" />
              <span className="text-2xs text-obsidian-400 font-mono uppercase tracking-wider">
                Processando
              </span>
            </div>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-obsidian-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-end p-3">
          <div className="flex items-center gap-2">
            {/* Favorite */}
            <button
              onClick={handleFavorite}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-sm transition-all duration-150',
                isFavorited
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-obsidian-800/80 text-obsidian-300 hover:text-red-400'
              )}
            >
              <Heart
                size={14}
                className={cn(isFavorited && 'fill-current')}
              />
            </button>

            {/* Download / Adquirir */}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              title={isPurchased ? 'Download' : 'Adquirir foto'}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-sm transition-all duration-150',
                isPurchased
                  ? 'bg-gold-500/20 text-gold-400 hover:bg-gold-500/30'
                  : 'bg-obsidian-800/80 text-obsidian-400 hover:text-gold-400 hover:bg-gold-500/10'
              )}
            >
              {isDownloading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : isPurchased ? (
                <Download size={14} />
              ) : (
                <ShoppingBag size={14} />
              )}
            </button>

            {/* Expand */}
            <button
              onClick={(e) => { e.stopPropagation(); openModal(index); }}
              className="w-8 h-8 rounded-lg bg-obsidian-800/80 text-obsidian-300 hover:text-obsidian-100 flex items-center justify-center backdrop-blur-sm transition-colors"
            >
              <ZoomIn size={14} />
            </button>

            {/* Delete — admin only */}
            {isAdmin && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                title="Excluir foto"
                className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300 flex items-center justify-center backdrop-blur-sm transition-all duration-150 disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Purchase badge */}
        {!photo.isPurchased && (
          <div className="absolute top-2 left-2">
            <span className="text-2xs px-1.5 py-0.5 rounded bg-obsidian-950/80 text-obsidian-500 font-mono backdrop-blur-sm border border-obsidian-700">
              Preview
            </span>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Excluir foto"
        description={`"${photo.filename}" será removida permanentemente. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir foto"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Purchase dialog */}
      <PurchaseDialog
        isOpen={showPurchase}
        target={{ type: 'photo' as const, photoId: photo.id, filename: photo.filename }}
        onSuccess={handlePurchaseSuccess}
        onCancel={() => setShowPurchase(false)}
      />
    </motion.div>
  );
}

// Skeleton
function PhotoSkeleton({ index }: { index: number }) {
  const heights = [200, 280, 180, 240, 200, 260, 180, 300, 220, 200, 250, 180];
  const h = heights[index % heights.length];

  return (
    <div className="photo-grid-item">
      <div className="skeleton rounded-xl" style={{ height: h }} />
    </div>
  );
}