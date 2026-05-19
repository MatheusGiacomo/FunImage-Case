'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  // Aguarda a hidratação do Zustand antes de renderizar
  // Evita flash de conteúdo ou crash antes do persist carregar
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (hydrated && !isLoading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [hydrated, isAuthenticated, isLoading, router]);

  // Mostra nada até o Zustand hidratar
  if (!hydrated) return null;

  // Ainda carregando auth
  if (isLoading) return null;

  // Não autenticado — redirect em andamento
  if (!isAuthenticated) return null;

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-surface overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}