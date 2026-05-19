'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Bell,
  Moon,
  Shield,
  ChevronRight,
  Check,
  Camera,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = 'profile' | 'appearance' | 'notifications' | 'security';

const sections: { id: Section; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'profile',       label: 'Perfil',        icon: User,   description: 'Nome, e-mail e foto' },
  { id: 'appearance',    label: 'Aparência',      icon: Moon,   description: 'Tema e preferências visuais' },
  { id: 'notifications', label: 'Notificações',   icon: Bell,   description: 'Alertas e e-mails' },
  { id: 'security',      label: 'Segurança',      icon: Shield, description: 'Senha e sessões ativas' },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [active, setActive] = useState<Section>('profile');

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-mono tracking-[0.3em] uppercase text-obsidian-500 mb-1">
          Conta
        </p>
        <h1 className="font-display text-4xl lg:text-5xl font-light text-obsidian-50">
          Configurações
        </h1>
        <div className="gold-divider mt-3" />
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Sidebar nav ── */}
        <motion.nav
          variants={container}
          initial="hidden"
          animate="show"
          className="lg:w-56 shrink-0 space-y-1"
        >
          {sections.map(({ id, label, icon: Icon, description }) => (
            <motion.button
              key={id}
              variants={item}
              onClick={() => setActive(id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 group',
                active === id
                  ? 'bg-gold-500/10 text-gold-400 border border-gold-500/20'
                  : 'text-obsidian-400 hover:bg-obsidian-800 hover:text-obsidian-100 border border-transparent'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                active === id ? 'bg-gold-500/20' : 'bg-obsidian-800 group-hover:bg-obsidian-700'
              )}>
                <Icon size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-none">{label}</p>
                <p className="text-xs text-obsidian-600 mt-0.5 leading-tight truncate">{description}</p>
              </div>
              {active === id && <ChevronRight size={13} className="ml-auto shrink-0 text-gold-400" />}
            </motion.button>
          ))}
        </motion.nav>

        {/* ── Panel ── */}
        <div className="flex-1 min-w-0">
          <motion.div
            key={active}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {active === 'profile'       && <ProfileSection />}
            {active === 'appearance'    && <AppearanceSection />}
            {active === 'notifications' && <NotificationsSection />}
            {active === 'security'      && <SecuritySection />}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Section ──────────────────────────────────────────────────────────

function ProfileSection() {
  const { user } = useAuthStore();
  const [name, setName]   = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulated save — connects to PATCH /api/users/me/ in production
    await new Promise((r) => setTimeout(r, 900));
    setIsSaving(false);
    toast.success('Perfil atualizado');
  };

  return (
    <div className="card p-6 space-y-6">
      <SectionHeader
        title="Perfil"
        description="Suas informações públicas na plataforma."
      />

      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gold-500/20 border border-gold-500/30 flex items-center justify-center">
            <span className="text-gold-400 text-2xl font-display font-light">
              {user?.name?.charAt(0) ?? '?'}
            </span>
          </div>
          <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-obsidian-700 border border-obsidian-600 flex items-center justify-center text-obsidian-400 hover:text-obsidian-100 transition-colors">
            <Camera size={11} />
          </button>
        </div>
        <div>
          <p className="text-sm font-medium text-obsidian-200">{user?.name}</p>
          <p className="text-xs text-obsidian-500">{user?.email}</p>
          <p className="text-xs text-obsidian-600 mt-1 font-mono uppercase tracking-wide">
            {user?.role === 'admin' ? 'Administrador' : 'Cliente'}
          </p>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-mono tracking-widest uppercase text-obsidian-500">
            Nome completo
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Seu nome"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono tracking-widest uppercase text-obsidian-500">
            E-mail
          </label>
          <input
            value={user?.email ?? ''}
            disabled
            className="input opacity-50 cursor-not-allowed"
          />
          <p className="text-xs text-obsidian-600">O e-mail não pode ser alterado.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono tracking-widest uppercase text-obsidian-500">
            Telefone
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input"
            placeholder="+55 (11) 99999-9999"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary"
        >
          {isSaving ? <><Loader2 size={14} className="animate-spin" /> Salvando…</> : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}

// ─── Appearance Section ───────────────────────────────────────────────────────

function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  const themes = [
    {
      id: 'dark' as const,
      label: 'Escuro',
      preview: (
        <div className="w-full h-10 rounded-lg overflow-hidden flex border border-zinc-700">
          <div className="w-1/4 bg-zinc-900 h-full" />
          <div className="flex-1 bg-zinc-950 h-full flex flex-col justify-center gap-1 px-2">
            <div className="h-1.5 w-3/4 rounded bg-zinc-700" />
            <div className="h-1.5 w-1/2 rounded bg-zinc-800" />
          </div>
        </div>
      ),
    },
    {
      id: 'light' as const,
      label: 'Claro',
      preview: (
        <div className="w-full h-10 rounded-lg overflow-hidden flex border border-stone-200">
          <div className="w-1/4 bg-white h-full" />
          <div className="flex-1 bg-stone-100 h-full flex flex-col justify-center gap-1 px-2">
            <div className="h-1.5 w-3/4 rounded bg-stone-300" />
            <div className="h-1.5 w-1/2 rounded bg-stone-200" />
          </div>
        </div>
      ),
    },
    {
      id: 'system' as const,
      label: 'Sistema',
      preview: (
        <div className="w-full h-10 rounded-lg overflow-hidden flex border border-zinc-400">
          <div className="w-1/2 bg-zinc-950 h-full flex flex-col justify-center gap-1 px-2">
            <div className="h-1.5 w-3/4 rounded bg-zinc-700" />
          </div>
          <div className="w-1/2 bg-stone-100 h-full flex flex-col justify-center gap-1 px-2">
            <div className="h-1.5 w-3/4 rounded bg-stone-300" />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="card p-6 space-y-6">
      <SectionHeader
        title="Aparência"
        description="Personalize a interface da plataforma."
      />

      <div className="space-y-3">
        <label className="text-xs font-mono tracking-widest uppercase text-obsidian-500">
          Tema
        </label>
        <div className="grid grid-cols-3 gap-3">
          {themes.map(({ id, label, preview }) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              className={cn(
                'relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200',
                theme === id
                  ? 'border-gold-500 bg-gold-500/5'
                  : 'border-obsidian-700 bg-obsidian-800/50 hover:border-obsidian-600'
              )}
            >
              {preview}
              <span className="text-xs text-obsidian-300">{label}</span>
              {theme === id && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-gold-500 flex items-center justify-center">
                  <Check size={10} className="text-obsidian-950" />
                </div>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-obsidian-600">
          O tema claro usa uma paleta creme e marfim, otimizada para ambientes iluminados.
        </p>
      </div>

      <ToggleRow
        label="Animações reduzidas"
        description="Diminui movimentos e transições"
        defaultChecked={false}
      />
      <ToggleRow
        label="Grade compacta"
        description="Exibe mais fotos por linha"
        defaultChecked={false}
      />
    </div>
  );
}

// ─── Notifications Section ────────────────────────────────────────────────────

function NotificationsSection() {
  return (
    <div className="card p-6 space-y-6">
      <SectionHeader
        title="Notificações"
        description="Controle quando e como você é notificado."
      />

      <div className="space-y-4">
        <p className="text-xs font-mono tracking-widest uppercase text-obsidian-500">
          E-mail
        </p>
        <ToggleRow
          label="Novas fotos na galeria"
          description="Quando o fotógrafo adicionar novas fotos"
          defaultChecked={true}
        />
        <ToggleRow
          label="Download disponível"
          description="Quando suas fotos estiverem prontas para download"
          defaultChecked={true}
        />
        <ToggleRow
          label="Compartilhamento de galeria"
          description="Quando uma galeria for compartilhada com você"
          defaultChecked={false}
        />

        <div className="h-px bg-obsidian-700 my-2" />

        <p className="text-xs font-mono tracking-widest uppercase text-obsidian-500">
          Plataforma
        </p>
        <ToggleRow
          label="Atualizações do sistema"
          description="Manutenção e novidades da plataforma"
          defaultChecked={false}
        />
      </div>
    </div>
  );
}

// ─── Security Section ─────────────────────────────────────────────────────────

function SecuritySection() {
  const [currentPwd, setCurrentPwd]   = useState('');
  const [newPwd, setNewPwd]           = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [isSaving, setIsSaving]       = useState(false);

  const handleChangePassword = async () => {
    if (newPwd !== confirmPwd) {
      toast.error('As senhas não coincidem');
      return;
    }
    if (newPwd.length < 8) {
      toast.error('A nova senha deve ter ao menos 8 caracteres');
      return;
    }
    setIsSaving(true);
    // Simulated — connects to POST /api/users/me/change-password/ in production
    await new Promise((r) => setTimeout(r, 900));
    setIsSaving(false);
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    toast.success('Senha alterada com sucesso');
  };

  return (
    <div className="space-y-4">
      <div className="card p-6 space-y-5">
        <SectionHeader
          title="Alterar senha"
          description="Use uma senha forte e única."
        />

        <div className="space-y-4">
          {[
            { label: 'Senha atual',     value: currentPwd, setter: setCurrentPwd, placeholder: '••••••••' },
            { label: 'Nova senha',      value: newPwd,     setter: setNewPwd,     placeholder: 'Mínimo 8 caracteres' },
            { label: 'Confirmar senha', value: confirmPwd, setter: setConfirmPwd, placeholder: 'Repita a nova senha' },
          ].map(({ label, value, setter, placeholder }) => (
            <div key={label} className="space-y-1.5">
              <label className="text-xs font-mono tracking-widest uppercase text-obsidian-500">
                {label}
              </label>
              <input
                type="password"
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder={placeholder}
                className="input"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleChangePassword}
            disabled={isSaving || !currentPwd || !newPwd || !confirmPwd}
            className="btn-primary"
          >
            {isSaving ? <><Loader2 size={14} className="animate-spin" /> Salvando…</> : 'Alterar senha'}
          </button>
        </div>
      </div>

      {/* Sessions (decorative) */}
      <div className="card p-6 space-y-4">
        <SectionHeader
          title="Sessões ativas"
          description="Dispositivos com acesso à sua conta."
        />
        {[
          { device: 'Chrome — macOS',       time: 'Agora',         current: true },
          { device: 'Safari — iPhone',      time: 'Há 2 horas',    current: false },
          { device: 'FotoPro App — Android',time: 'Há 3 dias',     current: false },
        ].map(({ device, time, current }) => (
          <div key={device} className="flex items-center justify-between">
            <div>
              <p className="text-sm text-obsidian-200">{device}</p>
              <p className="text-xs text-obsidian-500">{time}</p>
            </div>
            {current ? (
              <span className="text-2xs font-mono px-2 py-1 rounded-full bg-gold-500/10 text-gold-400 border border-gold-500/20">
                Atual
              </span>
            ) : (
              <button className="text-xs text-obsidian-500 hover:text-red-400 transition-colors">
                Encerrar
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-light text-obsidian-50">{title}</h2>
      <p className="text-sm text-obsidian-500 mt-1">{description}</p>
      <div className="h-px bg-obsidian-700 mt-4" />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  defaultChecked,
}: {
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  const [enabled, setEnabled] = useState(defaultChecked);

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-obsidian-200">{label}</p>
        <p className="text-xs text-obsidian-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => setEnabled((v) => !v)}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0',
          enabled ? 'bg-gold-500' : 'bg-obsidian-700'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
            enabled ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}