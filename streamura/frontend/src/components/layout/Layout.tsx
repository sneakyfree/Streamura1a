import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { CreatorOnboarding } from '@/components/onboarding';
import { useOnboarding } from '@/hooks/useOnboarding';

export function Layout() {
  const { showOnboarding, completeOnboarding, skipOnboarding } = useOnboarding();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
      <Toaster position="top-center" richColors />

      {showOnboarding && (
        <CreatorOnboarding
          onComplete={completeOnboarding}
          onSkip={skipOnboarding}
        />
      )}
    </div>
  );
}
