import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
