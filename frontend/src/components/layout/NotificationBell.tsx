'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, X, Check, CheckCheck,
  ImageIcon, FolderOpen, Download, FolderPlus, Sparkles,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type NotificationType =
  | 'photo_uploaded'
  | 'photo_ready'
  | 'album_created'
  | 'photo_downloaded'
  | 'album_downloaded';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  photo_uploaded:   <ImageIcon size={14} />,
  photo_ready:      <Sparkles size={14} />,
  album_created:    <FolderPlus size={14} />,
  photo_downloaded: <Download size={14} />,
  album_downloaded: <Download size={14} />,
};

const TYPE_COLOR: Record<NotificationType, string> = {
  photo_uploaded:   '#3B82F6',
  photo_ready:      '#10B981',
  album_created:    '#8B5CF6',
  photo_downloaded: '#F59E0B',
  album_downloaded: '#F59E0B',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min`;
  if (h < 24) return `${h}h`;
  return `${d}d`;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Fetch unread count (lightweight — runs on interval) ──────────────
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data } = await apiClient.get<{ count: number }>('/notifications/unread-count/');
      setUnreadCount((data as any).count ?? 0);
    } catch {}
  }, []);

  // ── Fetch full list (only when dropdown opens) ───────────────────────
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<Notification[]>('/notifications/');
      const list = Array.isArray(data) ? data : (data as any).data ?? [];
      setNotifications(list as Notification[]);
      setUnreadCount(list.filter((n: Notification) => !n.isRead).length);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll unread count every 30s
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch list when opened
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Actions ──────────────────────────────────────────────────────────
  const markOne = useCallback(async (id: string) => {
    try {
      await apiClient.post(`/notifications/${id}/read/`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  }, []);

  const markAll = useCallback(async () => {
    try {
      await apiClient.post('/notifications/read-all/');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 hover:bg-[var(--color-hover)]"
        style={{ color: 'var(--color-text-secondary)' }}
        aria-label="Notificações"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold px-0.5"
            style={{
              backgroundColor: '#EF4444',
              color: '#fff',
              border: '2px solid var(--color-topbar)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-80 rounded-xl overflow-hidden z-50"
            style={{
              backgroundColor: 'var(--color-card)',
              border: '1px solid var(--color-card-border)',
              boxShadow: 'var(--shadow-card-hover)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--color-divider)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Notificações
                </span>
                {unreadCount > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: '#EF444420', color: '#EF4444' }}
                  >
                    {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAll}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors hover:bg-[var(--color-hover)]"
                    style={{ color: 'var(--color-text-muted)' }}
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck size={12} />
                    <span>Todas</span>
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-hover)]"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div
                    className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: 'var(--color-text-muted)', borderTopColor: 'transparent' }}
                  />
                </div>
              )}

              {!loading && notifications.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10">
                  <Bell size={28} style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Nenhuma notificação
                  </p>
                </div>
              )}

              {!loading && notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="relative flex gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-hover)] cursor-default"
                  style={{
                    borderBottom: '1px solid var(--color-divider)',
                    backgroundColor: notif.isRead ? 'transparent' : 'rgba(59,130,246,0.04)',
                  }}
                >
                  {/* Unread dot */}
                  {!notif.isRead && (
                    <span
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: '#3B82F6' }}
                    />
                  )}

                  {/* Icon */}
                  <div
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg mt-0.5"
                    style={{
                      backgroundColor: TYPE_COLOR[notif.type] + '1A',
                      color: TYPE_COLOR[notif.type],
                    }}
                  >
                    {TYPE_ICON[notif.type]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-6">
                    <p
                      className="text-sm font-medium leading-snug"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {notif.title}
                    </p>
                    <p
                      className="text-xs mt-0.5 leading-relaxed line-clamp-2"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {notif.message}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}>
                      {timeAgo(notif.createdAt)}
                    </p>
                  </div>

                  {/* Mark read button */}
                  {!notif.isRead && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markOne(notif.id); }}
                      className="absolute right-3 top-3 w-6 h-6 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-hover)]"
                      style={{ color: 'var(--color-text-muted)' }}
                      title="Marcar como lida"
                    >
                      <Check size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}