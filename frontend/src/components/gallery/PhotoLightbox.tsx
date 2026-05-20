'use client';

import { useEffect, useCallback, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Info,
  Loader2,
  Lock,
  Trash2,
  ShoppingBag,
} from 'lucide-react';
import { useGalleryStore } from '@/store/gallery.store';
import { useAuthStore } from '@/store/auth.store';
import { photoApi, downloadFile } from '@/lib/api';
import { formatDate, formatBytes } from '@/lib/utils';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PurchaseDialog from '@/components/ui/PurchaseDialog';
import type { PurchaseTarget } from '@/components/ui/PurchaseDialog';
import toast from 'react-hot-toast';
import type { Photo } from '@/types';

interface PhotoLightboxProps {
  isOpen: boolean;
  photos: Photo[];
  currentIndex: number;
  onClose: () => void;
}

export default function PhotoLightbox({
  isOpen,
  photos,
  currentIndex,
  onClose,
}: PhotoLightboxProps) {
  const { navigateModal, toggleFavorite, deletePhoto } = useGalleryStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [showInfo, setShowInfo] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [isPurchased, setIsPurchased] = useState(false);

  const photo = photos[currentIndex];

  // Keep local state in sync when the current photo changes (navigation)
  useEffect(() => {
    setIsFavorited(photo?.isFavorited ?? false);
    setIsPurchased(photo?.isPurchased ?? false);
  }, [photo?.id, photo?.isFavorited, photo?.isPurchased]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      switch (e.key) {
        case 'Escape': onClose(); break;
        case 'ArrowLeft': navigateModal('prev'); break;
        case 'ArrowRight': navigateModal('next'); break;
        case 'i': case 'I': setShowInfo((v) => !v); break;
      }
    },
    [isOpen, onClose, navigateModal]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleDownload = async () => {
    if (!photo) return;
    if (!isPurchased) { setShowPurchase(true); return; }
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
    if (photo) {
      photoApi.getDownloadUrl(photo.id).then(({ url, filename }) => downloadFile(url, filename));
    }
  };

  const handleFavorite = async () => {
    if (!photo) return;
    const next = !isFavorited;
    setIsFavorited(next);
    try {
      await toggleFavorite(photo.id);
    } catch {
      setIsFavorited(!next); // revert on error
      toast.error('Erro ao atualizar favorito');
    }
  };

  const handleDelete = async () => {
    if (!photo) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!photo) return;
    setIsDeleting(true);
    try {
      await deletePhoto(photo.id);
      toast.success('Foto excluída');
      setShowDeleteConfirm(false);
      if (photos.length <= 1) onClose();
    } catch {
      toast.error('Erro ao excluir foto');
      setIsDeleting(false);
    }
  };

  if (!photo) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/95 backdrop-blur-xl"
          onClick={onClose}
        >
          {/* Controls (top) */}
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Counter */}
            <span className="font-mono text-sm text-obsidian-400">
              {currentIndex + 1} / {photos.length}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <ActionButton
                onClick={() => setShowInfo((v) => !v)}
                active={showInfo}
                title="Informações (I)"
              >
                <Info size={17} />
              </ActionButton>

              <ActionButton onClick={handleFavorite} title="Favoritar">
                <Heart
                  size={17}
                  className={isFavorited ? 'fill-red-400 text-red-400' : ''}
                />
              </ActionButton>

              <ActionButton
                onClick={handleDownload}
                disabled={isDownloading}
                title={isPurchased ? 'Download' : 'Adquirir foto'}
              >
                {isDownloading ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : isPurchased ? (
                  <Download size={17} />
                ) : (
                  <ShoppingBag size={17} />
                )}
              </ActionButton>

              {/* Delete — admin only */}
              {isAdmin && (
                <>
                  <div className="w-px h-5 bg-obsidian-700" />
                  <ActionButton
                    onClick={handleDelete}
                    disabled={isDeleting}
                    title="Excluir foto"
                    variant="danger"
                  >
                    {isDeleting ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Trash2 size={17} />
                    )}
                  </ActionButton>
                </>
              )}

              <div className="w-px h-5 bg-obsidian-700" />

              <ActionButton onClick={onClose} title="Fechar (Esc)">
                <X size={17} />
              </ActionButton>
            </div>
          </div>

          {/* Foto */}
          <AnimatePresence mode="wait">
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="relative max-w-[calc(100vw-120px)] max-h-[calc(100vh-120px)]"
              onClick={(e) => e.stopPropagation()}
            >
              {photo.watermarkedUrl ? (
              <Image
                src={photo.watermarkedUrl}
                alt={photo.filename}
                width={photo.width || 1200}
                height={photo.height || 800}
                className="object-contain max-h-[calc(100vh-120px)] rounded-xl shadow-2xl"
                priority
              />
              ) : (
              <div
                className="flex flex-col items-center justify-center rounded-xl bg-obsidian-800 border border-obsidian-700"
                style={{ width: 600, height: 400 }}
              >
                <Loader2 size={32} className="text-gold-400 animate-spin mb-3" />
                <span className="text-sm text-obsidian-400 font-mono uppercase tracking-wider">
                  Processando imagem…
                </span>
              </div>
              )}

              {/* Indicador de marca d'agua */}
              {!photo.isPurchased && (
                <div className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-obsidian-950/80 backdrop-blur-sm border border-obsidian-700">
                  <Lock size={11} className="text-gold-400" />
                  <span className="text-2xs text-obsidian-400 font-mono uppercase tracking-wider">
                    Preview com marca d'água
                  </span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Nav arrows */}
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); navigateModal('prev'); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-obsidian-800/80 hover:bg-obsidian-700 backdrop-blur-sm flex items-center justify-center text-obsidian-300 hover:text-obsidian-100 transition-all border border-obsidian-700 hover:border-obsidian-500"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); navigateModal('next'); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-obsidian-800/80 hover:bg-obsidian-700 backdrop-blur-sm flex items-center justify-center text-obsidian-300 hover:text-obsidian-100 transition-all border border-obsidian-700 hover:border-obsidian-500"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {/* Info Panel */}
          <AnimatePresence>
            {showInfo && (
              <motion.aside
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.25 }}
                className="absolute right-0 top-0 bottom-0 w-72 bg-obsidian-900/95 backdrop-blur-xl border-l border-obsidian-700 p-6 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-display text-xl font-light text-obsidian-50 mb-6">
                  Detalhes
                </h3>

                <div className="space-y-4">
                  <InfoRow label="Arquivo" value={photo.filename} mono />
                  <InfoRow label="Tamanho" value={formatBytes(photo.size)} />
                  <InfoRow label="Dimensões" value={photo.width && photo.height ? `${photo.width} × ${photo.height}px` : 'Processando...'} />
                  <InfoRow label="Formato" value={photo.mimeType.split('/')[1].toUpperCase()} />
                  <InfoRow label="Enviado em" value={formatDate(photo.createdAt)} />

                  {photo.metadata && (
                    <>
                      <div className="h-px bg-obsidian-700 my-2" />
                      <p className="text-2xs font-mono uppercase tracking-widest text-obsidian-600">
                        EXIF
                      </p>
                      {photo.metadata.camera && (
                        <InfoRow label="Câmera" value={photo.metadata.camera} />
                      )}
                      {photo.metadata.lens && (
                        <InfoRow label="Lente" value={photo.metadata.lens} />
                      )}
                      {photo.metadata.iso && (
                        <InfoRow label="ISO" value={String(photo.metadata.iso)} />
                      )}
                      {photo.metadata.aperture && (
                        <InfoRow label="Abertura" value={photo.metadata.aperture} />
                      )}
                      {photo.metadata.shutterSpeed && (
                        <InfoRow label="Velocidade" value={photo.metadata.shutterSpeed} />
                      )}
                      {photo.metadata.focalLength && (
                        <InfoRow label="Focal" value={photo.metadata.focalLength} />
                      )}
                    </>
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Strip (bottom thumbnails) */}
          {photos.length > 1 && (
            <div
              className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 py-4 px-6 overflow-x-auto no-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => {
                    const { openModal } = useGalleryStore.getState();
                    openModal(i);
                  }}
                  className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 transition-all duration-200 ${
                    i === currentIndex
                      ? 'ring-2 ring-gold-400 ring-offset-1 ring-offset-obsidian-950'
                      : 'opacity-40 hover:opacity-70'
                  }`}
                >
                  {(p.thumbnailUrl || p.watermarkedUrl) && (
                  <Image
                    src={p.thumbnailUrl || p.watermarkedUrl!}
                    alt=""
                    width={48}
                    height={48}
                    className="object-cover w-full h-full"
                  />
                  )}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Excluir foto"
        description={photo ? `"${photo.filename}" será removida permanentemente. Esta ação não pode ser desfeita.` : ''}
        confirmLabel="Excluir foto"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Purchase dialog */}
      {photo && (
        <PurchaseDialog
          isOpen={showPurchase}
          target={{ type: 'photo' as const, photoId: photo.id, filename: photo.filename }}
          onSuccess={handlePurchaseSuccess}
          onCancel={() => setShowPurchase(false)}
        />
      )}
    </AnimatePresence>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  active,
  title,
  variant,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  variant?: 'default' | 'danger';
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
        variant === 'danger'
          ? 'text-red-400 hover:bg-red-500/20 hover:text-red-300'
          : active
            ? 'bg-gold-500/20 text-gold-400'
            : 'text-obsidian-400 hover:bg-obsidian-800 hover:text-obsidian-100'
      }`}
    >
      {children}
    </button>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs font-mono uppercase tracking-widest text-obsidian-600">
        {label}
      </span>
      <span className={`text-sm text-obsidian-200 break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}