'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Images, MoreHorizontal, Trash2, Share2, Lock, Globe } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useGalleryStore } from '@/store/gallery.store';
import { galleryApi } from '@/lib/api';
import { cn, formatRelative } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useState } from 'react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import type { Gallery } from '@/types';

interface GalleryCardProps {
  gallery: Gallery;
  compact?: boolean;
}

// ─── Shimmer placeholder ──────────────────────────────────────────────────────

function PhotoSlot({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!src || error) {
    return <div className={cn('bg-obsidian-800', className)} />;
  }

  return (
    <div className={cn('relative overflow-hidden bg-obsidian-800', className)}>
      {/* Shimmer skeleton while image is loading */}
      {!loaded && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="h-full w-full animate-shimmer bg-gradient-to-r from-obsidian-800 via-obsidian-700/50 to-obsidian-800 bg-[length:400%_100%]" />
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        fill
        className={cn(
          'object-cover transition-opacity duration-500',
          loaded ? 'opacity-100' : 'opacity-0'
        )}
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 12vw"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

// ─── 2×2 photo grid preview ───────────────────────────────────────────────────

function CoverGrid({ gallery }: { gallery: Gallery }) {
  const photos = gallery.previewPhotos ?? (gallery.coverPhoto ? [gallery.coverPhoto] : []);
  const count = photos.length;

  if (count === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2.5">
        <Images size={30} className="text-obsidian-500" />
        <span className="text-xs text-obsidian-400 font-mono tracking-wide">sem fotos</span>
      </div>
    );
  }

  if (count === 1) {
    return (
      <PhotoSlot
        src={photos[0].thumbnailUrl || photos[0].watermarkedUrl}
        alt={gallery.name}
        className="w-full h-full"
      />
    );
  }

  if (count === 2) {
    return (
      <div className="grid grid-cols-2 w-full h-full gap-0.5">
        {photos.slice(0, 2).map((p) => (
          <PhotoSlot key={p.id} src={p.thumbnailUrl || p.watermarkedUrl} alt="" />
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="grid grid-cols-2 w-full h-full gap-0.5">
        <PhotoSlot
          src={photos[0].thumbnailUrl || photos[0].watermarkedUrl}
          alt=""
          className="row-span-2"
        />
        <PhotoSlot src={photos[1].thumbnailUrl || photos[1].watermarkedUrl} alt="" />
        <PhotoSlot src={photos[2].thumbnailUrl || photos[2].watermarkedUrl} alt="" />
      </div>
    );
  }

  // 4 photos — 2×2 grid
  return (
    <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-0.5">
      {photos.slice(0, 4).map((p) => (
        <PhotoSlot key={p.id} src={p.thumbnailUrl || p.watermarkedUrl} alt="" />
      ))}
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function GalleryCard({ gallery, compact = false }: GalleryCardProps) {
  const { deleteGallery } = useGalleryStore();
  const { user } = useAuthStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteGallery(gallery.id);
      toast.success('Galeria deletada');
      setShowDeleteConfirm(false);
    } catch {
      toast.error('Erro ao deletar galeria');
      setIsDeleting(false);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { shareUrl } = await galleryApi.getShareLink(gallery.id);
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copiado!');
    } catch {
      toast.error('Erro ao gerar link');
    }
  };

  if (compact) {
    const coverSrc =
      gallery.previewPhotos?.[0]?.thumbnailUrl ||
      gallery.previewPhotos?.[0]?.watermarkedUrl ||
      gallery.coverPhoto?.watermarkedUrl;

    return (
      <>
        <Link href={`/dashboard/gallery/${gallery.id}`}>
          <div className="card-hover flex items-center gap-4 p-4 group">
            {/* Cover */}
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 relative bg-obsidian-800">
              {coverSrc ? (
                <PhotoSlot src={coverSrc} alt={gallery.name} className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Images size={18} className="text-obsidian-500" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-obsidian-100 truncate group-hover:text-gold-400 transition-colors">
                {gallery.name}
              </p>
              <p className="text-xs text-obsidian-500 mt-0.5">
                {gallery.photoCount} fotos · {formatRelative(gallery.updatedAt)}
              </p>
            </div>

            {/* Badge */}
            <div className="flex items-center gap-1 text-obsidian-600">
              {gallery.isPublic ? <Globe size={13} /> : <Lock size={13} />}
            </div>

            {/* Menu */}
            <GalleryMenu onDelete={handleDelete} onShare={handleShare} />
          </div>
        </Link>

        <ConfirmDialog
          isOpen={showDeleteConfirm}
          title="Excluir galeria"
          description={`"${gallery.name}" e todas as suas fotos serão removidas permanentemente. Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir galeria"
          isLoading={isDeleting}
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </>
    );
  }

  return (
    <>
    <Link href={`/dashboard/gallery/${gallery.id}`}>
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
        className="group relative card overflow-hidden hover:border-obsidian-600 hover:shadow-card-hover transition-all duration-300"
      >
        {/* Cover image — 2×2 grid or single */}
        <div className="relative aspect-[4/3] overflow-hidden bg-obsidian-900">
          <CoverGrid gallery={gallery} />

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          {/* Privacy badge */}
          <div className="absolute top-2 left-2 z-10">
            <span className="flex items-center gap-1 text-2xs px-2 py-1 rounded-full bg-obsidian-900/80 backdrop-blur-sm text-obsidian-300 border border-obsidian-700">
              {gallery.isPublic ? <Globe size={10} /> : <Lock size={10} />}
              {gallery.isPublic ? 'Público' : 'Privado'}
            </span>
          </div>

          {/* Menu */}
          <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <GalleryMenu onDelete={handleDelete} onShare={handleShare} />
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-medium text-obsidian-100 truncate group-hover:text-gold-400 transition-colors duration-200">
            {gallery.name}
          </h3>
          {gallery.description && (
            <p className="text-xs text-obsidian-500 mt-0.5 truncate">{gallery.description}</p>
          )}
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-obsidian-500 font-mono">
              {gallery.photoCount} {gallery.photoCount === 1 ? 'foto' : 'fotos'}
            </span>
            <span className="text-xs text-obsidian-600">
              {formatRelative(gallery.updatedAt)}
            </span>
          </div>
        </div>
      </motion.div>
    </Link>

    <ConfirmDialog
      isOpen={showDeleteConfirm}
      title="Excluir galeria"
      description={`"${gallery.name}" e todas as suas fotos serão removidas permanentemente. Esta ação não pode ser desfeita.`}
      confirmLabel="Excluir galeria"
      isLoading={isDeleting}
      onConfirm={confirmDelete}
      onCancel={() => setShowDeleteConfirm(false)}
    />
    </>
  );
}

// ─── Gallery Menu ─────────────────────────────────────────────────────────────

function GalleryMenu({
  onDelete,
  onShare,
}: {
  onDelete: (e: React.MouseEvent) => void;
  onShare: (e: React.MouseEvent) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          onClick={(e) => e.preventDefault()}
          className="w-7 h-7 rounded-lg bg-obsidian-900/80 backdrop-blur-sm flex items-center justify-center text-obsidian-400 hover:text-obsidian-100 hover:bg-obsidian-700 transition-all border border-obsidian-700"
        >
          <MoreHorizontal size={14} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-40 card p-1.5 shadow-card-hover"
          sideOffset={4}
          align="end"
        >
          <DropdownMenu.Item
            onClick={onShare}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-obsidian-300 hover:bg-obsidian-700 hover:text-obsidian-100 cursor-pointer outline-none transition-colors"
          >
            <Share2 size={14} />
            Compartilhar
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="h-px bg-obsidian-700 my-1" />
          <DropdownMenu.Item
            onClick={onDelete}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 cursor-pointer outline-none transition-colors"
          >
            <Trash2 size={14} />
            Deletar
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}