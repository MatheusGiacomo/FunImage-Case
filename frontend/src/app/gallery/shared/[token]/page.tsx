'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Images, Lock, X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhotoPreview {
  id: string;
  thumbnailUrl: string | null;
  watermarkedUrl: string | null;
  width: number;
  height: number;
}

interface SharedGallery {
  id: string;
  name: string;
  description: string | null;
  photoCount: number;
  previewPhotos: PhotoPreview[];
  coverPhoto: PhotoPreview | null;
  createdAt: string;
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({
  photos,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  photos: PhotoPreview[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const photo = photos[index];
  const src = photo?.watermarkedUrl ?? photo?.thumbnailUrl;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
      >
        <X size={18} />
      </button>

      {/* Counter */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/50 text-sm font-mono">
        {index + 1} / {photos.length}
      </div>

      {/* Prev */}
      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Image */}
      <motion.div
        key={index}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative max-w-5xl max-h-[85vh] w-full mx-16"
        onClick={(e) => e.stopPropagation()}
        style={{ aspectRatio: photo?.width && photo?.height ? `${photo.width}/${photo.height}` : '4/3' }}
      >
        {src && (
          <Image
            src={src}
            alt=""
            fill
            className="object-contain"
            sizes="90vw"
          />
        )}
      </motion.div>

      {/* Next */}
      {index < photos.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <ChevronRight size={22} />
        </button>
      )}
    </motion.div>
  );
}

// ─── Photo Grid Item ──────────────────────────────────────────────────────────

function PhotoItem({ photo, index, onClick }: { photo: PhotoPreview; index: number; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const src = photo.thumbnailUrl ?? photo.watermarkedUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4) }}
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-xl bg-obsidian-800 cursor-zoom-in"
    >
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-obsidian-700" />
      )}
      {src && (
        <Image
          src={src}
          alt=""
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          onLoad={() => setLoaded(true)}
        />
      )}
      <div className="absolute inset-0 bg-obsidian-950/0 group-hover:bg-obsidian-950/30 transition-colors duration-300 flex items-center justify-center">
        <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SharedGalleryPage() {
  const { token } = useParams<{ token: string }>();
  const [gallery, setGallery] = useState<SharedGallery | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

  useEffect(() => {
    fetch(`${API_BASE}/galleries/shared/${token}/`)
      .then(async (res) => {
        if (!res.ok) { setNotFound(true); return; }
        const json = await res.json();
        // unwrap envelope { success, data } if present
        const raw = json?.success !== undefined ? json.data : json;
        // camelCase conversion
        const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        const keysToCamel = (obj: unknown): unknown => {
          if (Array.isArray(obj)) return obj.map(keysToCamel);
          if (obj && typeof obj === 'object') {
            return Object.fromEntries(
              Object.entries(obj as Record<string, unknown>).map(([k, v]) => [toCamel(k), keysToCamel(v)])
            );
          }
          return obj;
        };
        setGallery(keysToCamel(raw) as SharedGallery);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token, API_BASE]);

  const photos = gallery?.previewPhotos ?? [];

  const openLightbox = (i: number) => setLightbox(i);
  const closeLightbox = () => setLightbox(null);
  const prevPhoto = () => setLightbox((i) => (i !== null && i > 0 ? i - 1 : i));
  const nextPhoto = () => setLightbox((i) => (i !== null && i < photos.length - 1 ? i + 1 : i));

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-950 flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-gold-500"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────

  if (notFound || !gallery) {
    return (
      <div className="min-h-screen bg-obsidian-950 flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-obsidian-800 flex items-center justify-center mb-2">
          <Lock size={28} className="text-obsidian-500" />
        </div>
        <h1 className="font-display text-2xl font-light text-obsidian-200">Galeria não encontrada</h1>
        <p className="text-sm text-obsidian-500 max-w-sm">
          Este link pode ter expirado ou a galeria não está mais disponível publicamente.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs font-mono text-obsidian-600 tracking-widest uppercase">FotoPro</span>
        </div>
      </div>
    );
  }

  // ── Gallery ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="min-h-screen bg-obsidian-950">
        {/* Header */}
        <div className="border-b border-obsidian-800 bg-obsidian-900/50 backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gold-500/20 border border-gold-500/30 flex items-center justify-center">
                <span className="text-gold-500 text-xs font-bold">F</span>
              </div>
              <span className="text-sm font-mono text-obsidian-400 tracking-widest uppercase">FotoPro</span>
            </div>
            <span className="text-xs text-obsidian-600 font-mono">Galeria compartilhada</span>
          </div>
        </div>

        {/* Gallery info */}
        <div className="max-w-6xl mx-auto px-6 pt-12 pb-8">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-mono tracking-[0.3em] uppercase text-obsidian-500 mb-2">
              Galeria
            </p>
            <h1 className="font-display text-4xl lg:text-5xl font-light text-obsidian-50 mb-3">
              {gallery.name}<span className="text-gold-500">.</span>
            </h1>
            {gallery.description && (
              <p className="text-obsidian-400 text-base max-w-xl">{gallery.description}</p>
            )}
            <div className="flex items-center gap-3 mt-4">
              <div className="gold-divider w-12" />
              <span className="text-xs text-obsidian-500 font-mono flex items-center gap-1.5">
                <Images size={11} />
                {gallery.photoCount} {gallery.photoCount === 1 ? 'foto' : 'fotos'}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Photo grid */}
        <div className="max-w-6xl mx-auto px-6 pb-16">
          {photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-obsidian-800 flex items-center justify-center">
                <Images size={28} className="text-obsidian-600" />
              </div>
              <p className="text-obsidian-500 font-display text-xl font-light">Nenhuma foto disponível</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {photos.map((photo, i) => (
                <PhotoItem key={photo.id} photo={photo} index={i} onClick={() => openLightbox(i)} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-obsidian-800 py-6 text-center">
          <span className="text-xs text-obsidian-600 font-mono tracking-widest uppercase">
            Powered by FotoPro
          </span>
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && (
          <Lightbox
            photos={photos}
            index={lightbox}
            onClose={closeLightbox}
            onPrev={prevPhoto}
            onNext={nextPhoto}
          />
        )}
      </AnimatePresence>
    </>
  );
}