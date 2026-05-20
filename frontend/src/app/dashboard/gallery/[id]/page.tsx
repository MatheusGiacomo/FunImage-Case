'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Share2, ShoppingBag, Images, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useGalleryStore } from '@/store/gallery.store';
import PhotoGrid from '@/components/gallery/PhotoGrid';
import PhotoLightbox from '@/components/gallery/PhotoLightbox';
import UploadDropzone from '@/components/gallery/UploadDropzone';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/utils';
import { galleryApi } from '@/lib/api';
import PurchaseDialog, { type PurchaseTarget } from '@/components/ui/PurchaseDialog';
import toast from 'react-hot-toast';
import { useState } from 'react';

export default function GalleryPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const {
    currentGallery,
    photos,
    totalPhotos,
    hasNextPage,
    isLoadingPhotos,
    fetchGallery,
    fetchPhotos,
    fetchMorePhotos,
    modal,
    closeModal,
    reset,
  } = useGalleryStore();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [showAlbumPurchase, setShowAlbumPurchase] = useState(false);
  const [isDownloadingAlbum, setIsDownloadingAlbum] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Initial load
  useEffect(() => {
    if (id) {
      fetchGallery(id);
      fetchPhotos(id, 1);
    }
    // Limpa APENAS fotos e galeria atual ao sair — não toca em galleries[]
    // para não interferir com o fetch da página de listagem
    return () => {
      useGalleryStore.setState({
        currentGallery: null,
        photos:        [],
        totalPhotos:   0,
        currentPage:   1,
        hasNextPage:   false,
      });
    };
  }, [id, fetchGallery, fetchPhotos]);

  // Infinite scroll observer
  const handleIntersect = useCallback(
    ([entry]: IntersectionObserverEntry[]) => {
      if (entry.isIntersecting && hasNextPage && !isLoadingPhotos) {
        fetchMorePhotos(id);
      }
    },
    [hasNextPage, isLoadingPhotos, fetchMorePhotos, id]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    observerRef.current = new IntersectionObserver(handleIntersect, {
      rootMargin: '400px',
    });
    observerRef.current.observe(sentinel);
    return () => observerRef.current?.disconnect();
  }, [handleIntersect]);

  const handleDownloadAlbum = async () => {
    if (!currentGallery) return;
    setIsDownloadingAlbum(true);
    try {
      await galleryApi.downloadAlbum(currentGallery.id, currentGallery.name);
      toast.success('Download iniciado!');
    } catch {
      toast.error('Erro ao baixar álbum. Certifique-se de ter adquirido as fotos.');
    } finally {
      setIsDownloadingAlbum(false);
    }
  };

  const handleShare = async () => {
    try {
      const { shareUrl } = await galleryApi.getShareLink(id);
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copiado para a área de transferência');
    } catch {
      toast.error('Erro ao gerar link de compartilhamento');
    }
  };

  return (
    <div className="min-h-full">
      {/* ── Gallery Header ── */}
      <div className="sticky top-0 z-10 bg-obsidian-900/90 backdrop-blur-xl border-b border-obsidian-700">
        <div className="px-6 lg:px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            {/* Back */}
            <Link
              href="/dashboard/galleries"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-obsidian-400 hover:bg-obsidian-800 hover:text-obsidian-100 transition-all"
            >
              <ArrowLeft size={18} />
            </Link>

            {/* Gallery info */}
            <div className="flex-1 min-w-0">
              {currentGallery ? (
                <>
                  <h1 className="font-display text-2xl font-light text-obsidian-50 truncate">
                    {currentGallery.name}
                  </h1>
                  <p className="text-xs text-obsidian-500 font-mono flex items-center gap-2 mt-0.5">
                    <Images size={11} />
                    {totalPhotos} {totalPhotos === 1 ? 'foto' : 'fotos'}
                    <span className="text-obsidian-700">·</span>
                    Criada em {formatDate(currentGallery.createdAt)}
                  </p>
                </>
              ) : (
                <div className="space-y-1">
                  <div className="skeleton h-6 w-48 rounded" />
                  <div className="skeleton h-3 w-32 rounded" />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {user?.role !== 'admin' && photos.length > 0 && (
                <>
                  {/* Adquirir álbum */}
                  <button
                    onClick={() => setShowAlbumPurchase(true)}
                    className="btn-ghost gap-2 text-sm py-2 text-gold-400 hover:text-gold-300 border-gold-500/30 hover:border-gold-400/50"
                  >
                    <ShoppingBag size={14} />
                    <span className="hidden sm:inline">Adquirir álbum</span>
                  </button>

                  {/* Download álbum completo */}
                  <button
                    onClick={handleDownloadAlbum}
                    disabled={isDownloadingAlbum}
                    className="btn-ghost gap-2 text-sm py-2"
                    title="Baixar álbum completo (ZIP)"
                  >
                    {isDownloadingAlbum
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Download size={14} />}
                    <span className="hidden sm:inline">
                      {isDownloadingAlbum ? 'Baixando…' : 'Baixar álbum'}
                    </span>
                  </button>
                </>
              )}
              {user?.role === 'admin' && (
                <button
                  onClick={() => setUploadOpen(true)}
                  className="btn-primary gap-2 text-sm py-2"
                >
                  <Upload size={14} />
                  <span className="hidden sm:inline">Upload</span>
                </button>
              )}
              <button onClick={handleShare} className="btn-ghost gap-2 text-sm py-2">
                <Share2 size={14} />
                <span className="hidden sm:inline">Compartilhar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Photo Grid ── */}
      <div className="px-6 lg:px-8 py-6 max-w-7xl mx-auto">
        {photos.length === 0 && !isLoadingPhotos ? (
          <EmptyGallery isAdmin={user?.role === 'admin'} onUpload={() => setUploadOpen(true)} />
        ) : (
          <PhotoGrid photos={photos} isLoading={isLoadingPhotos} />
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-4 mt-4" />

        {/* Loading more indicator */}
        {isLoadingPhotos && photos.length > 0 && (
          <div className="flex justify-center py-8">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-gold-500"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      <PhotoLightbox
        isOpen={modal.isOpen}
        photos={modal.photos}
        currentIndex={modal.photoIndex ?? 0}
        onClose={closeModal}
      />

      {/* ── Upload Dropzone ── */}
      {uploadOpen && (
        <UploadDropzone
          galleryId={id}
          onClose={() => setUploadOpen(false)}
          onSuccess={() => {
            setUploadOpen(false);
            fetchPhotos(id, 1);
          }}
        />
      )}

      {/* ── Album Purchase Dialog ── */}
      {currentGallery && (
        <PurchaseDialog
          isOpen={showAlbumPurchase}
          target={{
            type: 'album',
            galleryId: currentGallery.id,
            galleryName: currentGallery.name,
            photoCount: totalPhotos,
          }}
          onSuccess={() => {
            setShowAlbumPurchase(false);
            // Refresh photos so isPurchased is updated for all
            fetchPhotos(id, 1);
            toast.success('Álbum adquirido! Todos os downloads estão liberados.');
          }}
          onCancel={() => setShowAlbumPurchase(false)}
        />
      )}
    </div>
  );
}

function EmptyGallery({
  isAdmin,
  onUpload,
}: {
  isAdmin: boolean;
  onUpload: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-32 text-center space-y-4"
    >
      <div className="w-20 h-20 rounded-2xl bg-obsidian-800 flex items-center justify-center">
        <Images size={32} className="text-obsidian-600" />
      </div>
      <p className="font-display text-2xl font-light text-obsidian-400">
        Galeria vazia
      </p>
      {isAdmin ? (
        <>
          <p className="text-sm text-obsidian-600">
            Faça upload das primeiras fotos
          </p>
          <button onClick={onUpload} className="btn-primary">
            <Upload size={16} />
            Fazer upload
          </button>
        </>
      ) : (
        <p className="text-sm text-obsidian-600">
          As fotos aparecerão aqui quando forem adicionadas
        </p>
      )}
    </motion.div>
  );
}