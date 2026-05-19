'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, CheckCircle2, AlertCircle, Loader2, ImagePlus } from 'lucide-react';
import { photoApi } from '@/lib/api';
import { validateImageFile, formatBytes, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
  preview: string;
}

interface UploadDropzoneProps {
  galleryId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadDropzone({
  galleryId,
  onClose,
  onSuccess,
}: UploadDropzoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: File[]) => {
    const valid: UploadFile[] = [];

    for (const file of newFiles) {
      const error = validateImageFile(file);
      if (error) {
        toast.error(error);
        continue;
      }
      const preview = URL.createObjectURL(file);
      valid.push({
        file,
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        progress: 0,
        status: 'pending',
        preview,
      });
    }

    setFiles((prev) => [...prev, ...valid]);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const f = prev.find((f) => f.id === id);
      if (f) URL.revokeObjectURL(f.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = Array.from(e.dataTransfer.files);
      addFiles(dropped);
    },
    [addFiles]
  );

  const handleUpload = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    try {
      await photoApi.upload(
        galleryId,
        pendingFiles.map((f) => f.file),
        (fileIndex, progress) => {
          setFiles((prev) =>
            prev.map((f, i) =>
              i === fileIndex ? { ...f, progress, status: 'uploading' } : f
            )
          );
        }
      );

      // Mark all as done
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploading' ? { ...f, status: 'done', progress: 100 } : f
        )
      );

      toast.success(`${pendingFiles.length} foto(s) enviada(s) com sucesso!`);
      setTimeout(onSuccess, 800);
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploading'
            ? { ...f, status: 'error', error: 'Falha no upload' }
            : f
        )
      );
      toast.error('Erro durante o upload. Verifique os arquivos e tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const doneCount = files.filter((f) => f.status === 'done').length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-xl p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 16 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-2xl card overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-obsidian-700">
          <div>
            <h2 className="font-display text-2xl font-light text-obsidian-50">
              Upload de fotos
            </h2>
            <p className="text-xs text-obsidian-500 mt-0.5">
              JPG, PNG, WebP · Máximo 50MB por arquivo
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-obsidian-500 hover:text-obsidian-100 hover:bg-obsidian-800 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Dropzone */}
        <div className="p-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200',
              isDragging
                ? 'border-gold-400 bg-gold-500/5'
                : 'border-obsidian-600 hover:border-obsidian-500 hover:bg-obsidian-800/50'
            )}
          >
            <motion.div
              animate={isDragging ? { scale: 1.1 } : { scale: 1 }}
              className="w-14 h-14 rounded-2xl bg-obsidian-800 flex items-center justify-center"
            >
              {isDragging ? (
                <ImagePlus size={24} className="text-gold-400" />
              ) : (
                <Upload size={22} className="text-obsidian-500" />
              )}
            </motion.div>
            <div className="text-center">
              <p className="text-sm font-medium text-obsidian-300">
                {isDragging ? 'Solte as fotos aqui' : 'Arraste fotos ou clique para selecionar'}
              </p>
              <p className="text-xs text-obsidian-600 mt-1">
                Suporte a múltiplos arquivos
              </p>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                const selected = Array.from(e.target.files ?? []);
                addFiles(selected);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* File list */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-4 space-y-2 max-h-64 overflow-y-auto">
                {files.map((f) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-obsidian-800 border border-obsidian-700"
                  >
                    {/* Preview */}
                    <div
                      className="w-10 h-10 rounded-lg overflow-hidden bg-obsidian-700 shrink-0"
                      style={{
                        backgroundImage: `url(${f.preview})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-obsidian-200 truncate">{f.file.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-obsidian-500">
                          {formatBytes(f.file.size)}
                        </span>
                        {f.status === 'uploading' && (
                          <div className="flex-1 h-1 bg-obsidian-700 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gold-400 rounded-full"
                              animate={{ width: `${f.progress}%` }}
                              transition={{ duration: 0.2 }}
                            />
                          </div>
                        )}
                        {f.status === 'error' && (
                          <span className="text-xs text-red-400">{f.error}</span>
                        )}
                      </div>
                    </div>

                    {/* Status icon */}
                    <div className="shrink-0">
                      {f.status === 'pending' && (
                        <button
                          onClick={() => removeFile(f.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-obsidian-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <X size={13} />
                        </button>
                      )}
                      {f.status === 'uploading' && (
                        <Loader2 size={16} className="text-gold-400 animate-spin" />
                      )}
                      {f.status === 'done' && (
                        <CheckCircle2 size={16} className="text-emerald-400" />
                      )}
                      {f.status === 'error' && (
                        <AlertCircle size={16} className="text-red-400" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        {files.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-obsidian-700 bg-obsidian-800/50">
            <span className="text-sm text-obsidian-500">
              {pendingCount > 0
                ? `${pendingCount} arquivo(s) para enviar`
                : `${doneCount} arquivo(s) enviado(s)`}
            </span>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-ghost text-sm py-2">
                Cancelar
              </button>
              {pendingCount > 0 && (
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="btn-primary text-sm py-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Enviar {pendingCount} foto(s)
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
