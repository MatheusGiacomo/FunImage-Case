'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus confirm button when opens; Esc to cancel
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => confirmRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onCancel, onConfirm]);

  const iconBg = variant === 'danger' ? 'bg-red-500/10' : 'bg-amber-500/10';
  const iconColor = variant === 'danger' ? 'text-red-400' : 'text-amber-400';
  const btnClass =
    variant === 'danger'
      ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500/40'
      : 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500/40';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] bg-obsidian-950/80 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-sm rounded-2xl border border-obsidian-700 bg-obsidian-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between p-5 pb-0">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
                  {variant === 'danger' ? (
                    <Trash2 size={18} className={iconColor} />
                  ) : (
                    <AlertTriangle size={18} className={iconColor} />
                  )}
                </div>
                <button
                  onClick={onCancel}
                  className="w-8 h-8 rounded-lg text-obsidian-500 hover:text-obsidian-200 hover:bg-obsidian-800 flex items-center justify-center transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 pt-3 pb-5">
                <h3 className="text-base font-semibold text-obsidian-100 mb-1">{title}</h3>
                <p className="text-sm text-obsidian-400 leading-relaxed">{description}</p>
              </div>

              {/* Divider */}
              <div className="h-px bg-obsidian-800 mx-5" />

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-4">
                <button
                  onClick={onCancel}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-obsidian-300 hover:text-obsidian-100 hover:bg-obsidian-800 transition-all duration-150 disabled:opacity-50"
                >
                  {cancelLabel}
                </button>
                <button
                  ref={confirmRef}
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-obsidian-900 disabled:opacity-50 disabled:cursor-not-allowed',
                    btnClass
                  )}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Excluindo…
                    </span>
                  ) : (
                    confirmLabel
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}