import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const titles = {
  '/app': 'Dashboard',
  '/app/campaigns': 'Campaigns',
  '/app/campaigns/new': 'Create campaign',
  '/app/contacts': 'Contacts',
  '/app/templates': 'Templates',
  '/app/analytics': 'Analytics',
  '/app/settings': 'Settings',
  '/app/pricing': 'Pricing',
};

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const title = titles[pathname] || 'MailPilot';

  return (
    <div className="flex min-h-screen bg-app-bg">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col lg:ml-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
