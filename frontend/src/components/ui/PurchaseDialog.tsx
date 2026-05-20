'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, Images, Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { photoApi, galleryApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export type PurchaseTarget =
  | { type: 'photo'; photoId: string; filename: string }
  | { type: 'album'; galleryId: string; galleryName: string; photoCount: number };

export interface PurchaseDialogProps {
  isOpen: boolean;
  target: PurchaseTarget | null;
  onSuccess: (target: PurchaseTarget) => void;
  onCancel: () => void;
}

const CODE_LENGTH = 6;

export default function PurchaseDialog({ isOpen, target, onSuccess, onCancel }: PurchaseDialogProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCode(''); setError(''); setSuccess(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  const handleSubmit = async () => {
    if (code.length !== CODE_LENGTH || !target) return;
    setIsLoading(true);
    setError('');
    try {
      if (target.type === 'photo') {
        await photoApi.purchase(target.photoId, code);
      } else {
        await galleryApi.purchase(target.galleryId, code);
      }
      setSuccess(true);
      setTimeout(() => {
        onSuccess(target);
        toast.success(
          target.type === 'photo'
            ? 'Foto liberada para download!'
            : `${target.photoCount} foto(s) liberadas para download!`
        );
      }, 900);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Código inválido. Tente novamente.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const isAlbum = target?.type === 'album';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] bg-obsidian-950/80 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-sm rounded-2xl border border-obsidian-700 bg-obsidian-900 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent" />

              <div className="flex items-start justify-between p-5 pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center">
                    {isAlbum ? <Images size={18} className="text-gold-400" /> : <ShoppingBag size={18} className="text-gold-400" />}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-obsidian-100">
                      {isAlbum ? 'Adquirir álbum completo' : 'Adquirir foto'}
                    </h3>
                    <p className="text-xs text-obsidian-500 mt-0.5 max-w-[200px] truncate">
                      {target?.type === 'album'
                        ? `${target.photoCount} foto${target.photoCount !== 1 ? 's' : ''} · ${target.galleryName}`
                        : target?.type === 'photo' ? target.filename : ''}
                    </p>
                  </div>
                </div>
                <button onClick={onCancel} className="w-8 h-8 rounded-lg text-obsidian-500 hover:text-obsidian-200 hover:bg-obsidian-800 flex items-center justify-center transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 pt-4 pb-5">
                {success ? (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3 py-4">
                    <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                      <CheckCircle2 size={28} className="text-green-400" />
                    </div>
                    <p className="text-sm font-medium text-green-400">{isAlbum ? 'Álbum liberado!' : 'Foto liberada!'}</p>
                    <p className="text-xs text-obsidian-500 text-center">O download está disponível agora.</p>
                  </motion.div>
                ) : (
                  <>
                    <p className="text-sm text-obsidian-400 mb-4 leading-relaxed">
                      Insira o código de acesso para liberar o download{isAlbum ? ' de todas as fotos do álbum' : ' desta foto'}.
                    </p>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian-500">
                        <Lock size={15} />
                      </div>
                      <input
                        ref={inputRef}
                        type="text"
                        inputMode="numeric"
                        maxLength={CODE_LENGTH}
                        value={code}
                        onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH)); setError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        placeholder="••••••"
                        className={cn(
                          'w-full pl-9 pr-4 py-3 rounded-xl bg-obsidian-800 border text-obsidian-100 text-center text-xl font-mono tracking-[0.5em] placeholder:tracking-widest placeholder:text-obsidian-600 outline-none transition-colors',
                          error ? 'border-red-500/60 focus:border-red-500' : 'border-obsidian-700 focus:border-gold-500/60'
                        )}
                      />
                    </div>
                    <AnimatePresence>
                      {error && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 mt-2 text-red-400 text-xs">
                          <AlertCircle size={13} />{error}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>

              {!success && (
                <>
                  <div className="h-px bg-obsidian-800 mx-5" />
                  <div className="flex items-center justify-end gap-2 p-4">
                    <button onClick={onCancel} disabled={isLoading} className="px-4 py-2 rounded-xl text-sm font-medium text-obsidian-300 hover:text-obsidian-100 hover:bg-obsidian-800 transition-all duration-150 disabled:opacity-50">
                      Cancelar
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isLoading || code.length !== CODE_LENGTH}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-obsidian-950 bg-gold-400 hover:bg-gold-300 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoading ? (
                        <><Loader2 size={14} className="animate-spin" />Verificando…</>
                      ) : 'Confirmar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}