'use client'

import { useState } from 'react'
import { Bell, Search, LogOut, Menu, X, Zap } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { signout } from '@/app/login/actions'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Activity,
  BarChart3,
  Settings,
  Megaphone,
  FileText,
} from 'lucide-react'

interface HeaderProps {
  userEmail?: string | null
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/activity', label: 'Activity', icon: Activity },
  { href: '/dashboard/reports', label: 'Reports', icon: FileText },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export default function Header({ userEmail }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (item: { href: string; exact?: boolean }) => {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  return (
    <>
      <header className="sticky top-0 z-30 h-16 flex items-center justify-between gap-4 px-4 md:px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/50">
        {/* Mobile logo + hamburger */}
        <div className="flex items-center gap-3 md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white">EMAIL AUTOMATION</span>
          </div>
        </div>

        {/* Search - hidden on mobile */}
        <div className="hidden md:flex items-center gap-2 max-w-sm flex-1">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-8 h-8 text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Notifications */}
          <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* Avatar */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-semibold">
              {userEmail ? userEmail[0].toUpperCase() : 'U'}
            </div>
            <span className="hidden md:block text-sm font-medium text-slate-700 dark:text-slate-200 max-w-[140px] truncate">
              {userEmail}
            </span>
          </div>

          {/* Sign out */}
          <form action={signout}>
            <Button type="submit" variant="ghost" size="sm" className="hidden md:flex text-slate-500 hover:text-red-500 hover:bg-red-50">
              <LogOut className="w-4 h-4 mr-1" />
              Sign out
            </Button>
          </form>
        </div>
      </header>

      {/* Mobile Nav Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute left-0 top-0 bottom-0 w-72 bg-slate-900 text-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-6 p-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg">MailFlow</span>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive(item)
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="absolute bottom-4 left-4 right-4">
              <div className="px-3 py-2 mb-2 text-sm text-slate-400 truncate">{userEmail}</div>
              <form action={signout}>
                <button
                  type="submit"
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
