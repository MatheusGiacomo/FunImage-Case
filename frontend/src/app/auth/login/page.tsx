'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

// Schema
const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

// Component
export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  // Reset para preencher o formulário automaticamente
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LoginForm>({ 
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      toast.success('Bem-vindo de volta');
      window.location.assign('/dashboard')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Credenciais inválidas';
      toast.error(message);
    }
  };

  // Função auxiliar para os botões de demo
  const handleDemoLogin = (data: LoginForm) => {
    reset(data); // Preenche os campos visualmente
    onSubmit(data); // Dispara a função de login
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface flex items-center justify-center">

      {/* ── Botão voltar ── */}
      <div className="absolute top-5 left-6 z-20">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-obsidian-500 hover:text-obsidian-200 transition-colors group"
        >
          <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" />
          Voltar ao início
        </Link>
      </div>

      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full bg-gold-500/5 blur-[120px]" />
        <div className="absolute -bottom-60 -left-40 h-[500px] w-[500px] rounded-full bg-gold-700/4 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">

        {/* Left: Branding */}
        <motion.div
          initial={{ opacity: 0, x: -32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:flex flex-col gap-10"
        >
          <div className="flex flex-col gap-2">
            <span className="font-mono text-2xs tracking-[0.4em] uppercase text-gold-500 mb-1">
              estúdio
            </span>
            <h1 className="font-display text-7xl font-light tracking-tight leading-none text-obsidian-50">
              Foto
              <span className="italic text-gold-400">Pro</span>
            </h1>
            <div className="gold-divider mt-3" />
          </div>

          <p className="font-body text-obsidian-400 text-lg leading-relaxed max-w-xs">
            Suas memórias merecem a melhor entrega. Visualize, baixe e compartilhe com segurança.
          </p>

          <div className="flex flex-wrap gap-2">
            {['Marca d\'água automática', 'Download seguro', 'Galerias organizadas', 'Compartilhamento'].map(
              (f) => (
                <span
                  key={f}
                  className="text-2xs font-mono tracking-wide uppercase px-3 py-1.5 rounded-full border border-obsidian-700 text-obsidian-500"
                >
                  {f}
                </span>
              )
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 opacity-40">
            {[
              'https://picsum.photos/seed/a1/200/250',
              'https://picsum.photos/seed/a2/200/150',
              'https://picsum.photos/seed/a3/200/200',
              'https://picsum.photos/seed/a4/200/180',
              'https://picsum.photos/seed/a5/200/220',
              'https://picsum.photos/seed/a6/200/160',
            ].map((src, i) => (
              <div
                key={i}
                className="aspect-square rounded-lg overflow-hidden bg-obsidian-800"
                style={{
                  backgroundImage: `url(${src})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* Right: Login form */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          <div className="lg:hidden mb-10 text-center">
            <h1 className="font-display text-5xl font-light text-obsidian-50">
              Foto<span className="italic text-gold-400">Pro</span>
            </h1>
          </div>

          <div className="card p-8 lg:p-10 space-y-8">
            <div>
              <h2 className="font-display text-3xl font-light text-obsidian-50">
                Acessar conta
              </h2>
              <p className="mt-1 text-sm text-obsidian-500">
                Entre com suas credenciais para continuar
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-widest uppercase text-obsidian-500">
                  E-mail
                </label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className={cn('input', errors.email && 'border-red-500/60 focus:border-red-500')}
                />
                {errors.email && (
                  <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-widest uppercase text-obsidian-500">
                  Senha
                </label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={cn(
                      'input pr-12',
                      errors.password && 'border-red-500/60 focus:border-red-500'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-obsidian-500 hover:text-obsidian-300 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full mt-2 h-12 text-base font-medium tracking-wide"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Entrando…
                  </>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-obsidian-700" />
              <span className="text-xs text-obsidian-600 font-mono">ou</span>
              <div className="h-px flex-1 bg-obsidian-700" />
            </div>

            {/* Demo hint */}
            <div className="rounded-xl border border-obsidian-700 bg-obsidian-800/50 p-4 space-y-2">
              <p className="text-xs font-mono text-obsidian-500 uppercase tracking-widest">
                Acesso de demonstração
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDemoLogin({
                    email: 'cliente@fotopro.com',
                    password: 'demo1234',
                  })}
                  className="btn-ghost text-xs py-2 px-3 border border-obsidian-700"
                >
                  Cliente demo
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoLogin({
                    email: 'admin@fotopro.com',
                    password: 'admin1234',
                  })}
                  className="btn-ghost text-xs py-2 px-3 border border-obsidian-700"
                >
                  Admin demo
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}