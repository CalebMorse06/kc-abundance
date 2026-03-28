'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, MapPin, AlertTriangle, BarChart3,
  Menu, X, ChevronRight, LogOut, Globe, Route,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { AbundanceSpinner } from '@/components/AbundanceSpinner';

const navItems = [
  { href: '/dashboard', label: 'Command Center', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/sites', label: 'Sites', icon: MapPin },
  { href: '/dashboard/supply', label: 'Supply Alerts', icon: AlertTriangle },
  { href: '/dashboard/map', label: 'Distribution Map', icon: Route },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
];

function SidebarNav({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string>('ops_admin');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserEmail(data.user.email ?? null);
        supabase
          .from('profiles')
          .select('role, display_name')
          .eq('id', data.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            if (profile?.role) setRole(profile.role);
          });
      }
    });
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--dash-navy)' }}>
      {/* Logo */}
      <div
        className="flex items-center justify-between px-4 h-16"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <AbundanceSpinner size={28} strokeWidth={7} />
          <div>
            <div
              className="text-sm font-bold text-white leading-none"
              style={{ fontFamily: 'var(--font-jakarta, sans-serif)' }}
            >
              Abundance-KC
            </div>
            <div className="text-xs leading-none mt-0.5" style={{ color: 'var(--dash-sidebar-text)' }}>
              Operations
            </div>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="p-1" style={{ color: 'var(--dash-sidebar-text)' }}>
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn('flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all')}
              style={
                isActive
                  ? {
                      background: 'var(--dash-navy-light)',
                      color: 'var(--dash-sidebar-text-active)',
                      borderLeft: '3px solid var(--brand-orange)',
                      paddingLeft: '9px',
                      paddingRight: '12px',
                    }
                  : {
                      color: 'var(--dash-sidebar-text)',
                      borderLeft: '3px solid transparent',
                      paddingLeft: '9px',
                      paddingRight: '12px',
                    }
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{item.label}</span>
              {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-40" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom panel */}
      <div
        className="px-4 py-4 space-y-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* User info */}
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
            style={{ background: 'var(--brand-orange)', color: 'var(--brand-navy)' }}
          >
            OP
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </div>
            <div className="text-xs truncate" style={{ color: 'var(--dash-sidebar-text)' }}>
              {userEmail ?? 'ops@abundance-kc.org'}
            </div>
          </div>
        </div>

        <Link
          href="/"
          className="flex items-center gap-2 text-xs transition-colors hover:text-white"
          style={{ color: 'var(--dash-sidebar-text)' }}
        >
          <Globe className="h-3.5 w-3.5" />
          <span>Switch to resident view</span>
        </Link>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-xs transition-colors hover:text-red-400 w-full"
          style={{ color: 'var(--dash-sidebar-text)' }}
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--muted)' }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0">
        <SidebarNav />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">
            <SidebarNav onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div
          className="lg:hidden flex items-center justify-between px-4 h-14 bg-white"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center justify-center h-9 w-9 rounded-lg border"
            style={{ borderColor: 'var(--border)', color: 'var(--brand-navy)' }}
          >
            <Menu className="h-4 w-4" />
          </button>
          <span
            className="text-sm font-bold"
            style={{ color: 'var(--brand-navy)', fontFamily: 'var(--font-jakarta, sans-serif)' }}
          >
            Abundance-KC — Ops
          </span>
          <Link href="/" className="text-xs transition-colors hover:text-gray-600" style={{ color: 'var(--dash-sidebar-text)' }}>
            Public site
          </Link>
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
