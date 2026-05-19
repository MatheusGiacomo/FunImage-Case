'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  Images,
  Heart,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Upload,
  Users,
  BarChart3,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Nav items ────────────────────────────────────────────────────────────────

const clientNav = [
  { href: '/dashboard/dashboard', icon: LayoutGrid, label: 'Início' },
  { href: '/dashboard/galleries', icon: Images,     label: 'Galerias' },
  { href: '/dashboard/favorites', icon: Heart,      label: 'Favoritos' },
];

const adminNav = [
  { href: '/dashboard/dashboard', icon: BarChart3, label: 'Overview' },
  { href: '/dashboard/galleries', icon: Images,    label: 'Galerias' },
  { href: '/dashboard/favorites', icon: Heart,     label: 'Favoritos' },
  { href: '/dashboard/upload',    icon: Upload,    label: 'Upload' },
  { href: '/dashboard/clients',   icon: Users,     label: 'Clientes' },
];

const bottomNav = [
  { href: '/dashboard/settings', icon: Settings, label: 'Configurações' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = user?.role === 'admin' ? adminNav : clientNav;

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/auth/login');
      toast.success('Até logo!');
    } catch {
      toast.error('Erro ao sair');
    }
  };

  // All hrefs are full paths — startsWith works cleanly for all cases
  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{ backgroundColor: 'var(--color-sidebar)', borderRight: '1px solid var(--color-card-border)' }}
      className="relative flex flex-col h-full overflow-hidden shrink-0 z-20"
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 h-16 shrink-0" style={{ borderBottom: '1px solid var(--color-card-border)' }}>
        <div className="w-8 h-8 rounded-lg bg-gold-500 flex items-center justify-center shrink-0">
          <span className="font-display text-obsidian-950 font-bold text-sm italic">F</span>
        </div>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="font-display text-xl font-light whitespace-nowrap"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Foto<span className="italic text-gold-400">Pro</span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto no-scrollbar">
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={<item.icon size={20} />}
              label={item.label}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          ))}
        </div>

        <div className="my-4 h-px mx-2" style={{ backgroundColor: 'var(--color-divider)' }} />

        <div className="space-y-1">
          {bottomNav.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={<item.icon size={20} />}
              label={item.label}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          ))}
        </div>
      </nav>

      {/* ── User & Logout ── */}
      <div className="p-3" style={{ borderTop: '1px solid var(--color-card-border)', backgroundColor: 'var(--color-hover)' }}>
        <div className={cn(
          'flex items-center gap-3 px-2 py-3 rounded-xl mb-2',
          collapsed && 'justify-center px-0'
        )}>
          <div className="w-9 h-9 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center shrink-0">
            <span className="text-gold-500 text-sm font-bold uppercase">
              {user?.name?.[0] ?? 'U'}
            </span>
          </div>

          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col min-w-0"
            >
              <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                {user?.name ?? 'Usuário'}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                {user?.role === 'admin' ? 'Administrador' : 'Cliente'}
              </span>
            </motion.div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200',
            collapsed && 'justify-center'
          )}
          style={{ color: 'var(--color-text-muted)' }}
        >
          <LogOut size={20} />
          {!collapsed && <span className="text-sm font-medium">Sair da conta</span>}
        </button>
      </div>

      {/* ── Collapse toggle ── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-0 top-20 translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center hover:text-gold-400 hover:border-gold-500/50 transition-all z-30 shadow-xl"
        style={{
          backgroundColor: 'var(--color-card)',
          border: '1px solid var(--color-card-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </motion.aside>
  );
}

// ─── NavItem ──────────────────────────────────────────────────────────────────

function NavItem({
  href,
  icon,
  label,
  active,
  collapsed,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
        active ? 'bg-gold-500/10 text-gold-500' : '',
        collapsed && 'justify-center px-0'
      )}
      style={!active ? { color: 'var(--color-text-secondary)' } : undefined}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-hover)';
          (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.backgroundColor = '';
          (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)';
        }
      }}
    >
      <span className={cn(
        'shrink-0 transition-transform duration-200',
        active ? 'scale-110' : 'group-hover:scale-110'
      )}>
        {icon}
      </span>

      {!collapsed && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm font-medium whitespace-nowrap"
        >
          {label}
        </motion.span>
      )}

      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 w-1 h-6 bg-gold-500 rounded-r-full"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}

      {collapsed && (
        <div
          className="absolute left-16 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-md"
          style={{
            backgroundColor: 'var(--color-card)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-card-border)',
          }}
        >
          {label}
        </div>
      )}
    </Link>
  );
}