'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  UserCheck,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  Activity,
  Star,
  MapPin,
  Calendar,
  MoreHorizontal,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Animations ───────────────────────────────────────────────────────────────

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Static data ──────────────────────────────────────────────────────────────

const STAT_CARDS = [
  {
    label: 'Total de clientes',
    value: '248',
    icon: Users,
    trend: +18,
    sub: 'vs. mês passado',
  },
  {
    label: 'Ativos este mês',
    value: '134',
    icon: Activity,
    trend: +7,
    sub: 'acessaram a plataforma',
  },
  {
    label: 'Compraram fotos',
    value: '89',
    icon: ShoppingBag,
    trend: +23,
    sub: '35% do total',
  },
  {
    label: 'NPS médio',
    value: '4.8',
    icon: Star,
    trend: +4,
    sub: 'de 5.0 possíveis',
  },
];

const MONTHLY_DATA = [
  { month: 'Nov', novos: 18, ativos: 90 },
  { month: 'Dez', novos: 24, ativos: 105 },
  { month: 'Jan', novos: 31, ativos: 112 },
  { month: 'Fev', novos: 27, ativos: 118 },
  { month: 'Mar', novos: 38, ativos: 127 },
  { month: 'Abr', novos: 42, ativos: 134 },
];

const CLIENTS = [
  { id: 1, name: 'Ana Souza',       email: 'ana.souza@email.com',    city: 'São Paulo, SP',     joined: '12 jan. 2026', photos: 84,  status: 'comprou',   avatar: 'A' },
  { id: 2, name: 'Rafael Lima',     email: 'rafael@empresa.com',     city: 'Campinas, SP',      joined: '03 fev. 2026', photos: 61,  status: 'ativo',     avatar: 'R' },
  { id: 3, name: 'Mariana Costa',   email: 'm.costa@hotmail.com',    city: 'Rio de Janeiro, RJ',joined: '17 fev. 2026', photos: 138, status: 'comprou',   avatar: 'M' },
  { id: 4, name: 'Pedro Alves',     email: 'palves@gmail.com',       city: 'Belo Horizonte, MG',joined: '01 mar. 2026', photos: 22,  status: 'inativo',   avatar: 'P' },
  { id: 5, name: 'Juliana Ferreira',email: 'ju.ferreira@email.com',  city: 'Curitiba, PR',      joined: '09 mar. 2026', photos: 97,  status: 'comprou',   avatar: 'J' },
  { id: 6, name: 'Bruno Mendes',    email: 'brunomendes@outlook.com',city: 'Porto Alegre, RS',  joined: '22 mar. 2026', photos: 45,  status: 'ativo',     avatar: 'B' },
  { id: 7, name: 'Camila Torres',   email: 'camila.t@email.com',     city: 'Florianópolis, SC', joined: '02 abr. 2026', photos: 113, status: 'comprou',   avatar: 'C' },
  { id: 8, name: 'Diego Rocha',     email: 'diego.rocha@empresa.com',city: 'Salvador, BA',      joined: '14 abr. 2026', photos: 0,   status: 'novo',      avatar: 'D' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  comprou: { label: 'Comprou',  color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  ativo:   { label: 'Ativo',    color: 'text-gold-400',    bg: 'bg-gold-400/10'    },
  inativo: { label: 'Inativo',  color: 'text-obsidian-500',bg: 'bg-obsidian-800'   },
  novo:    { label: 'Novo',     color: 'text-blue-400',    bg: 'bg-blue-400/10'    },
};

const CITY_DATA = [
  { city: 'São Paulo, SP',      count: 89 },
  { city: 'Rio de Janeiro, RJ', count: 47 },
  { city: 'Campinas, SP',       count: 31 },
  { city: 'Curitiba, PR',       count: 28 },
  { city: 'Belo Horizonte, MG', count: 22 },
  { city: 'Outros',             count: 31 },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('todos');

  const filtered = CLIENTS.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'todos' || c.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-6 lg:p-8 space-y-10 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-mono tracking-[0.3em] uppercase text-obsidian-500 mb-1">
          Administração
        </p>
        <h1 className="font-display text-4xl lg:text-5xl font-light text-obsidian-50">
          Clientes
          <span className="text-obsidian-500">.</span>
        </h1>
        <div className="gold-divider mt-3" />
      </motion.div>

      {/* ── Stat Cards ── */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {STAT_CARDS.map(({ label, value, icon: Icon, trend, sub }) => (
          <motion.div key={label} variants={item}>
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-obsidian-800 flex items-center justify-center">
                  <Icon size={17} className="text-gold-400" />
                </div>
                <span
                  className={cn(
                    'flex items-center gap-1 text-xs font-mono',
                    trend >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {trend >= 0 ? '+' : ''}{trend}%
                </span>
              </div>
              <div>
                <p className="text-2xl font-display font-light text-obsidian-50">{value}</p>
                <p className="text-xs text-obsidian-500 mt-0.5">{label}</p>
                {sub && <p className="text-[11px] text-obsidian-600 mt-1">{sub}</p>}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Crescimento mensal */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <h2 className="font-display text-2xl font-light text-obsidian-100">
              Crescimento mensal
            </h2>
            <div className="gold-divider mt-2" />
          </div>

          <div className="card p-6">
            <div className="flex items-end gap-1 sm:gap-2 h-40 mb-4">
              {MONTHLY_DATA.map(({ month, novos, ativos }, i) => {
                const maxAtivos = Math.max(...MONTHLY_DATA.map((d) => d.ativos));
                const maxNovos = Math.max(...MONTHLY_DATA.map((d) => d.novos));
                return (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end gap-0.5" style={{ height: '120px' }}>
                      {/* Barra ativos */}
                      <motion.div
                        className="flex-1 bg-obsidian-700 rounded-t-md"
                        title={`Ativos: ${ativos}`}
                        initial={{ height: 0 }}
                        animate={{ height: `${(ativos / maxAtivos) * 100}%` }}
                        transition={{ duration: 0.6, delay: i * 0.07, ease: 'easeOut' }}
                      />
                      {/* Barra novos */}
                      <motion.div
                        className="flex-1 bg-gold-500 rounded-t-md"
                        title={`Novos: ${novos}`}
                        initial={{ height: 0 }}
                        animate={{ height: `${(novos / maxNovos) * 100}%` }}
                        transition={{ duration: 0.6, delay: i * 0.07 + 0.1, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-obsidian-600">{month}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-5 pt-3 border-t border-obsidian-800">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-gold-500" />
                <span className="text-xs text-obsidian-500">Novos clientes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-obsidian-700" />
                <span className="text-xs text-obsidian-500">Clientes ativos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Por cidade */}
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-2xl font-light text-obsidian-100">
              Por cidade
            </h2>
            <div className="gold-divider mt-2" />
          </div>

          <div className="card p-5 space-y-3">
            {CITY_DATA.map(({ city, count }, idx) => {
              const max = CITY_DATA[0].count;
              const pct = Math.round((count / max) * 100);
              return (
                <motion.div
                  key={city}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.07 }}
                  className="space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={11} className="text-obsidian-600" />
                      <span className="text-xs text-obsidian-300">{city}</span>
                    </div>
                    <span className="text-xs font-mono text-obsidian-500">{count}</span>
                  </div>
                  <div className="h-1 rounded-full bg-obsidian-800 overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full', idx === 0 ? 'bg-gold-500' : 'bg-obsidian-600')}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, delay: idx * 0.07 + 0.2, ease: 'easeOut' }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Client table ── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-light text-obsidian-100">
              Lista de clientes
            </h2>
            <div className="gold-divider mt-2" />
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente…"
                className="input pl-8 py-2 h-9 text-xs w-44 sm:w-56"
              />
            </div>

            {/* Filter tabs */}
            <div className="flex rounded-xl overflow-hidden border border-obsidian-700">
              {['todos', 'comprou', 'ativo', 'inativo', 'novo'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                    filter === f
                      ? 'bg-gold-500 text-obsidian-950'
                      : 'text-obsidian-400 hover:bg-obsidian-800 hover:text-obsidian-200'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_80px_80px_36px] gap-4 px-4 py-3 border-b border-obsidian-800">
            {['Cliente', 'Cidade', 'Entrada', 'Fotos', 'Status', ''].map((h) => (
              <span key={h} className="text-[10px] font-mono uppercase tracking-wider text-obsidian-600">
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-obsidian-500 text-sm">
              Nenhum cliente encontrado
            </div>
          ) : (
            <div className="divide-y divide-obsidian-800">
              {filtered.map((client, idx) => {
                const status = STATUS_CONFIG[client.status];
                return (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.04 }}
                    className="grid grid-cols-[2fr_1.5fr_1fr_80px_80px_36px] gap-4 px-4 py-3.5 items-center hover:bg-obsidian-800/30 transition-colors"
                  >
                    {/* Name + email */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center shrink-0">
                        <span className="text-gold-500 text-xs font-bold">{client.avatar}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-obsidian-100 truncate">{client.name}</p>
                        <p className="text-[11px] text-obsidian-500 truncate">{client.email}</p>
                      </div>
                    </div>

                    {/* City */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MapPin size={11} className="text-obsidian-600 shrink-0" />
                      <span className="text-sm text-obsidian-400 truncate">{client.city}</span>
                    </div>

                    {/* Joined */}
                    <div className="flex items-center gap-1.5">
                      <Calendar size={11} className="text-obsidian-600 shrink-0" />
                      <span className="text-xs text-obsidian-500">{client.joined}</span>
                    </div>

                    {/* Photos */}
                    <span className="text-sm font-mono text-obsidian-300">{client.photos}</span>

                    {/* Status */}
                    <span
                      className={cn(
                        'inline-flex items-center justify-center text-[11px] font-medium px-2 py-0.5 rounded-full',
                        status.bg,
                        status.color
                      )}
                    >
                      {status.label}
                    </span>

                    {/* Menu */}
                    <button className="w-7 h-7 rounded-lg flex items-center justify-center text-obsidian-600 hover:bg-obsidian-700 hover:text-obsidian-300 transition-colors">
                      <MoreHorizontal size={14} />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-3 border-t border-obsidian-800 flex items-center justify-between">
            <span className="text-xs text-obsidian-600">
              Mostrando {filtered.length} de {CLIENTS.length} clientes
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((p) => (
                <button
                  key={p}
                  className={cn(
                    'w-7 h-7 rounded-lg text-xs font-mono transition-colors',
                    p === 1
                      ? 'bg-gold-500 text-obsidian-950'
                      : 'text-obsidian-500 hover:bg-obsidian-800 hover:text-obsidian-300'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Engagement ── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Taxa de conversão',   value: '35.9%', desc: 'clientes que compraram pelo menos 1 foto',  color: 'text-emerald-400' },
          { label: 'Retenção mensal',     value: '78.4%', desc: 'clientes que voltaram no mês seguinte',      color: 'text-gold-400'    },
          { label: 'Churn rate',          value: '4.2%',  desc: 'clientes que saíram nos últimos 30 dias',    color: 'text-red-400'     },
        ].map(({ label, value, desc, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-5 space-y-2"
          >
            <p className="text-xs text-obsidian-500 font-mono uppercase tracking-wider">{label}</p>
            <p className={cn('text-3xl font-display font-light', color)}>{value}</p>
            <p className="text-xs text-obsidian-600">{desc}</p>
          </motion.div>
        ))}
      </section>
    </div>
  );
}