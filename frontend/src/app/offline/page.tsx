'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-obsidian-950 flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mb-2">
        <span className="text-gold-500 text-xl font-bold">F</span>
      </div>
      <h1 className="font-display text-2xl font-light text-obsidian-100">
        Você está offline
      </h1>
      <p className="text-sm text-obsidian-500 max-w-sm leading-relaxed">
        Verifique sua conexão com a internet e tente novamente.
        Páginas visitadas recentemente ainda estão disponíveis.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-5 py-2.5 rounded-xl border border-gold-500/30 bg-gold-500/10 text-gold-400 text-sm hover:bg-gold-500/20 transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  );
}