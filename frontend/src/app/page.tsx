'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  Camera, Shield, Download, Images, Zap, Star,
  ArrowRight, ChevronDown, Lock, Globe, Sparkles,
  Check, Menu, X,
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.1 } },
};

const gallerySeeds = ['photo1','photo2','photo3','photo4','photo5','photo6','photo7','photo8','photo9'];

const features = [
  { icon: Shield,   title: 'Download seguro',          description: 'URLs assinadas com validade de 1 hora. Seus clientes acessam apenas o que compraram — nunca o arquivo direto.' },
  { icon: Zap,      title: "Marca d'água automática",  description: "Processamento assíncrono em background. Envie dezenas de fotos e a marca d'água é aplicada sem você esperar." },
  { icon: Images,   title: 'Galerias organizadas',     description: 'Cada cliente tem seu espaço. Organize por evento, data ou sessão. Compartilhe com um link único e seguro.' },
  { icon: Globe,    title: 'Compartilhamento público', description: 'Ative o link público de uma galeria para que seu cliente possa mostrar para a família — sem precisar de login.' },
  { icon: Lock,     title: 'Privacidade por padrão',   description: 'Toda galeria nasce privada. Você controla quem vê o quê, quando quer e por quanto tempo.' },
  { icon: Camera,   title: 'EXIF preservado',          description: 'Metadados técnicos da câmera, lente e configurações ficam registrados para cada foto. Profissionalismo completo.' },
];

const steps = [
  { number: '01', title: 'Crie a galeria',   description: 'Abra uma galeria para o cliente em segundos. Dê um nome, defina a privacidade e pronto.' },
  { number: '02', title: 'Faça o upload',    description: "Arraste dezenas de fotos de uma vez. A marca d'água é aplicada automaticamente em background." },
  { number: '03', title: 'Compartilhe',      description: 'Envie o link para o cliente. Ele visualiza, favorita e baixa as fotos que adquiriu — com segurança.' },
];

const testimonials = [
  { name: 'Mariana Oliveira', role: 'Fotógrafa de casamento', text: 'Finalmente uma plataforma que entende o fluxo real de um fotógrafo. Economizo horas por semana na entrega.', rating: 5 },
  { name: 'Rafael Santos',    role: 'Fotógrafo de newborn',   text: "Meus clientes adoram a experiência. A galeria é linda e o download seguro me dá paz de espírito.",     rating: 5 },
  { name: 'Camila Ferreira',  role: 'Fotógrafa corporativa',  text: "A marca d'água automática mudou minha vida. Envio as fotos e o sistema cuida do resto.",                  rating: 5 },
];

const planFree = ['5 galerias ativas','Upload ilimitado',"Marca d'água automática",'Download seguro','Link de compartilhamento'];
const planPro  = ['Galerias ilimitadas','Upload ilimitado',"Marca d'água personalizada",'Download seguro + CDN','Compartilhamento público','Metadados EXIF completos','Suporte prioritário'];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroY       = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div className="min-h-screen bg-surface text-obsidian-100 overflow-x-hidden">

      {/* ── Navbar ── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-obsidian-950/90 backdrop-blur-xl border-b border-obsidian-800' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gold-500 flex items-center justify-center shrink-0">
              <span className="font-display text-obsidian-950 font-bold text-sm italic">F</span>
            </div>
            <span className="font-display text-xl font-light text-obsidian-50">
              Foto<span className="italic text-gold-400">Pro</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {['Recursos','Como funciona','Depoimentos'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g,'-')}`}
                className="text-sm text-obsidian-400 hover:text-obsidian-100 transition-colors">{item}</a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-obsidian-400 hover:text-obsidian-100 transition-colors px-4 py-2">Entrar</Link>
            <Link href="/auth/login" className="btn-primary text-sm py-2 px-5">Começar grátis</Link>
          </div>

          <button onClick={() => setMenuOpen(v => !v)} className="md:hidden w-9 h-9 flex items-center justify-center text-obsidian-400">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-obsidian-950 border-b border-obsidian-800 px-6 pb-6 space-y-4"
            >
              {['Recursos','Como funciona','Depoimentos'].map((item) => (
                <a key={item} href={`#${item.toLowerCase().replace(/ /g,'-')}`}
                  onClick={() => setMenuOpen(false)}
                  className="block text-sm text-obsidian-400 hover:text-obsidian-100 py-1">{item}</a>
              ))}
              <div className="flex flex-col gap-2 pt-2">
                <Link href="/auth/login" className="btn-ghost text-sm justify-center border border-obsidian-700">Entrar</Link>
                <Link href="/auth/login" className="btn-primary text-sm justify-center">Começar grátis</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center pt-16 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gold-500/5 rounded-full blur-[140px]" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-gold-700/4 rounded-full blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.2) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.2) 1px,transparent 1px)', backgroundSize: '80px 80px' }} />
        </div>

        <motion.div style={{ opacity: heroOpacity, y: heroY }}
          className="relative z-10 flex flex-col items-center text-center px-6 max-w-5xl mx-auto">

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 mb-8">
            <Sparkles size={13} className="text-gold-400" />
            <span className="text-xs font-mono tracking-widest uppercase text-gold-400">Plataforma profissional de fotografia</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-5xl sm:text-6xl lg:text-8xl font-light leading-[0.95] tracking-tight text-obsidian-50">
            Entregue suas fotos
            <br /><span className="italic text-gold-400">com elegância.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-8 text-lg text-obsidian-400 max-w-xl leading-relaxed">
            Galerias privadas, marca d'água automática e download seguro.
            Tudo que um fotógrafo profissional precisa para impressionar seus clientes.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 mt-10">
            <Link href="/auth/login" className="btn-primary text-base px-8 py-3.5 gap-2">
              Começar agora <ArrowRight size={16} />
            </Link>
            <a href="#como-funciona" className="btn-ghost text-base px-8 py-3.5 border border-obsidian-700">
              Ver como funciona
            </a>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.7 }}
            className="flex items-center gap-3 mt-10 text-sm text-obsidian-500">
            <div className="flex -space-x-2">
              {['A','B','C','D'].map((l,i) => (
                <div key={l} className="w-7 h-7 rounded-full border-2 border-obsidian-950 bg-obsidian-700 flex items-center justify-center text-2xs font-medium text-obsidian-300"
                  style={{ zIndex: 4 - i }}>{l}</div>
              ))}
            </div>
            <span>+200 fotógrafos já usam a plataforma</span>
          </motion.div>
        </motion.div>

        {/* Gallery mosaic */}
        <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mt-20 w-full max-w-6xl mx-auto px-6">
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-surface to-transparent z-10 pointer-events-none" />
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 opacity-60">
            {gallerySeeds.map((seed, i) => (
              <motion.div key={seed}
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.7 + i * 0.05 }}
                className={`rounded-xl overflow-hidden bg-obsidian-800 ${i % 3 === 0 ? 'aspect-[3/4]' : i % 3 === 1 ? 'aspect-square' : 'aspect-[4/3]'} ${i >= 6 ? 'hidden lg:block' : i >= 4 ? 'hidden sm:block' : ''}`}>
                <img src={`https://picsum.photos/seed/${seed}/400/500`} alt="" className="w-full h-full object-cover" loading="lazy" />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-obsidian-600">
          <span className="text-xs font-mono tracking-widest uppercase">Scroll</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <ChevronDown size={16} />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section id="recursos" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-100px' }} className="text-center mb-20">
            <motion.p variants={fadeUp} className="text-xs font-mono tracking-[0.3em] uppercase text-gold-500 mb-3">Recursos</motion.p>
            <motion.h2 variants={fadeUp} className="font-display text-4xl lg:text-6xl font-light text-obsidian-50">
              Tudo que você precisa,<br /><span className="italic text-obsidian-400">nada que você não precisa.</span>
            </motion.h2>
          </motion.div>

          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, description }) => (
              <motion.div key={title} variants={fadeUp}
                className="group p-6 rounded-2xl border border-obsidian-700 bg-obsidian-900/50 hover:border-obsidian-600 hover:bg-obsidian-900 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mb-5 group-hover:bg-gold-500/15 transition-colors">
                  <Icon size={18} className="text-gold-400" />
                </div>
                <h3 className="font-display text-xl font-light text-obsidian-100 mb-2">{title}</h3>
                <p className="text-sm text-obsidian-500 leading-relaxed">{description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="como-funciona" className="py-32 px-6 bg-obsidian-900/30">
        <div className="max-w-5xl mx-auto">
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-100px' }} className="text-center mb-20">
            <motion.p variants={fadeUp} className="text-xs font-mono tracking-[0.3em] uppercase text-gold-500 mb-3">Como funciona</motion.p>
            <motion.h2 variants={fadeUp} className="font-display text-4xl lg:text-6xl font-light text-obsidian-50">
              Simples para você.<br /><span className="italic text-obsidian-400">Impressionante para o cliente.</span>
            </motion.h2>
          </motion.div>

          <div className="space-y-6">
            {steps.map(({ number, title, description }, i) => (
              <motion.div key={number}
                initial={{ opacity: 0, x: i % 2 === 0 ? -32 : 32 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-start gap-8 p-8 rounded-2xl border border-obsidian-700 bg-obsidian-900/50 group hover:border-gold-500/30 transition-all duration-300">
                <span className="font-display text-5xl font-light text-gold-500/30 group-hover:text-gold-500/50 transition-colors shrink-0 leading-none">{number}</span>
                <div>
                  <h3 className="font-display text-2xl font-light text-obsidian-100 mb-2">{title}</h3>
                  <p className="text-obsidian-500 leading-relaxed">{description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scrolling strip ── */}
      <section className="py-32">
        {/* Title stays centred with padding */}
        <div className="max-w-7xl mx-auto px-6">
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center mb-16">
            <motion.p variants={fadeUp} className="text-xs font-mono tracking-[0.3em] uppercase text-gold-500 mb-3">Galeria de exemplo</motion.p>
            <motion.h2 variants={fadeUp} className="font-display text-4xl lg:text-5xl font-light text-obsidian-50">Suas fotos, do jeito que merecem.</motion.h2>
          </motion.div>
        </div>

        {/* Strip is full-viewport-width; overflow clipped here, gradients cover full width */}
        <div className="relative overflow-hidden">
          {/* Gradients span the full viewport edge-to-edge */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-surface to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-surface to-transparent z-10 pointer-events-none" />

          <motion.div
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 30, ease: 'linear', repeat: Infinity }}
            className="flex gap-4 py-2"
            style={{ width: 'max-content' }}
          >
            {[...Array(2)].flatMap((_,ri) =>
              ['s1','s2','s3','s4','s5','s6','s7','s8'].map((seed,i) => (
                <div key={`${seed}-${ri}-${i}`} className="w-56 h-72 rounded-xl overflow-hidden shrink-0 bg-obsidian-800">
                  <img src={`https://picsum.photos/seed/${seed}x/400/600`} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))
            )}
          </motion.div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="depoimentos" className="py-32 px-6 bg-obsidian-900/30">
        <div className="max-w-6xl mx-auto">
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-100px' }} className="text-center mb-20">
            <motion.p variants={fadeUp} className="text-xs font-mono tracking-[0.3em] uppercase text-gold-500 mb-3">Depoimentos</motion.p>
            <motion.h2 variants={fadeUp} className="font-display text-4xl lg:text-6xl font-light text-obsidian-50">
              O que fotógrafos<br /><span className="italic text-obsidian-400">estão dizendo.</span>
            </motion.h2>
          </motion.div>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map(({ name, role, text, rating }) => (
              <motion.div key={name} variants={fadeUp}
                className="p-6 rounded-2xl border border-obsidian-700 bg-obsidian-900/50 flex flex-col gap-4">
                <div className="flex gap-1">
                  {Array.from({ length: rating }).map((_,i) => <Star key={i} size={13} className="text-gold-400 fill-gold-400" />)}
                </div>
                <p className="text-obsidian-300 leading-relaxed text-sm flex-1">"{text}"</p>
                <div className="flex items-center gap-3 pt-2 border-t border-obsidian-800">
                  <div className="w-9 h-9 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400 text-sm font-medium">
                    {name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-obsidian-100">{name}</p>
                    <p className="text-xs text-obsidian-500">{role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Plans ── */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center mb-16">
            <motion.p variants={fadeUp} className="text-xs font-mono tracking-[0.3em] uppercase text-gold-500 mb-3">Planos</motion.p>
            <motion.h2 variants={fadeUp} className="font-display text-4xl lg:text-5xl font-light text-obsidian-50">Simples e transparente.</motion.h2>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.6 }} className="grid md:grid-cols-2 gap-6">
            {/* Free */}
            <div className="p-8 rounded-2xl border border-obsidian-700 bg-obsidian-900/50 space-y-6">
              <div>
                <p className="text-xs font-mono tracking-widest uppercase text-obsidian-500">Básico</p>
                <p className="font-display text-5xl font-light text-obsidian-50 mt-2">Grátis</p>
                <p className="text-sm text-obsidian-500 mt-1">Para começar a usar</p>
              </div>
              <div className="h-px bg-obsidian-700" />
              <ul className="space-y-3">
                {planFree.map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-obsidian-300">
                    <Check size={14} className="text-gold-400 shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <Link href="/auth/login" className="btn-outline w-full justify-center">Começar grátis</Link>
            </div>

            {/* Pro */}
            <div className="relative p-8 rounded-2xl border border-gold-500/40 bg-gradient-to-b from-gold-500/5 to-transparent space-y-6">
              <div className="absolute top-4 right-4">
                <span className="text-2xs font-mono tracking-widest uppercase px-2.5 py-1 rounded-full bg-gold-500 text-obsidian-950 font-medium">Popular</span>
              </div>
              <div>
                <p className="text-xs font-mono tracking-widest uppercase text-gold-500">Profissional</p>
                <div className="flex items-end gap-1 mt-2">
                  <p className="font-display text-5xl font-light text-obsidian-50">R$49</p>
                  <p className="text-obsidian-500 mb-2">/mês</p>
                </div>
                <p className="text-sm text-obsidian-500 mt-1">Para fotógrafos sérios</p>
              </div>
              <div className="h-px bg-gold-500/20" />
              <ul className="space-y-3">
                {planPro.map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-obsidian-200">
                    <Check size={14} className="text-gold-400 shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <Link href="/auth/login" className="btn-primary w-full justify-center">
                Assinar agora <ArrowRight size={14} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-3xl border border-gold-500/20 bg-gradient-to-br from-obsidian-900 via-obsidian-900 to-gold-500/5 p-12 lg:p-20 text-center">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-gold-500/10 rounded-full blur-[80px] pointer-events-none" />
            <p className="text-xs font-mono tracking-[0.3em] uppercase text-gold-500 mb-4 relative z-10">Pronto para começar?</p>
            <h2 className="font-display text-4xl lg:text-6xl font-light text-obsidian-50 mb-6 relative z-10">
              Eleve a experiência<br /><span className="italic text-gold-400">dos seus clientes.</span>
            </h2>
            <p className="text-obsidian-400 mb-10 max-w-md mx-auto relative z-10">
              Junte-se a centenas de fotógrafos que já entregam com mais profissionalismo e menos trabalho.
            </p>
            <Link href="/auth/login" className="btn-primary text-base px-10 py-4 relative z-10 inline-flex gap-2">
              Criar conta gratuita <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-obsidian-800 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gold-500 flex items-center justify-center">
              <span className="font-display text-obsidian-950 font-bold text-xs italic">F</span>
            </div>
            <span className="font-display text-lg font-light text-obsidian-50">
              Foto<span className="italic text-gold-400">Pro</span>
            </span>
          </div>
          <p className="text-sm text-obsidian-600">© {new Date().getFullYear()} FotoPro. Todos os direitos reservados.</p>
          <div className="flex gap-6">
            {['Privacidade','Termos','Contato'].map(item => (
              <a key={item} href="#" className="text-sm text-obsidian-500 hover:text-obsidian-300 transition-colors">{item}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}