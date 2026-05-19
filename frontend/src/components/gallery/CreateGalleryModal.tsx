'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Loader2 } from 'lucide-react';
import { useGalleryStore } from '@/store/gallery.store';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface CreateGalleryModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateGalleryModal({ open, onClose }: CreateGalleryModalProps) {
  const { createGallery } = useGalleryStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      // Admin cria galeria para si mesmo por padrão; em produção,
      // adicione um campo para selecionar o cliente desejado
      const clientId = user?.role === 'admin' ? user.id : undefined;
      const gallery = await createGallery(name.trim(), description.trim() || undefined, clientId);
      toast.success(`Galeria "${gallery.name}" criada!`);
      onClose();
      setName('');
      setDescription('');
      if (gallery?.id) {
        router.push(`/dashboard/gallery/${gallery.id}`);
      } else {
        // Fallback: se o id não vier, recarrega a lista de galerias
        router.push('/dashboard/galleries');
      }
    } catch {
      toast.error('Erro ao criar galeria');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-xl p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md card p-6 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-light text-obsidian-50">
                Nova galeria
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-obsidian-500 hover:text-obsidian-100 hover:bg-obsidian-800 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-widest uppercase text-obsidian-500">
                  Nome <span className="text-gold-400">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Casamento Silva & Costa"
                  className="input"
                  autoFocus
                  maxLength={100}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-widest uppercase text-obsidian-500">
                  Descrição
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Opcional — descreva o evento ou sessão"
                  className="input resize-none h-20"
                  maxLength={500}
                />
              </div>

              {/* Visibility toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-obsidian-800 border border-obsidian-700">
                <div>
                  <p className="text-sm text-obsidian-200 font-medium">
                    {isPublic ? 'Galeria pública' : 'Galeria privada'}
                  </p>
                  <p className="text-xs text-obsidian-500 mt-0.5">
                    {isPublic
                      ? 'Qualquer pessoa com o link pode visualizar'
                      : 'Apenas o cliente pode acessar'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPublic((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                    isPublic ? 'bg-gold-500' : 'bg-obsidian-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                      isPublic ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-ghost flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || isLoading}
                  className="btn-primary flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Criando…
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      Criar galeria
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}