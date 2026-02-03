'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { 
  Scale, 
  LayoutDashboard, 
  Briefcase, 
  Calendar, 
  LogOut,
    Menu,
    X,
    Plus,
    User,
    Bell,
    ShieldCheck,
    FileText,
    ReceiptText,
    CheckSquare
  } from 'lucide-react'

  import { cn } from '@/lib/utils'
  import { Profile } from '@/lib/types'
  import { NotificationBell } from './notification-bell'
  import { GlobalSearch } from './global-search'
  
        const navItems = [
          { href: '/dashboard', label: "Today’s Agenda", icon: LayoutDashboard },
          { href: '/calendar', label: 'Firm Calendar', icon: Calendar },
          { href: '/cases', label: 'Cases Register', icon: Briefcase },
          { href: '/tasks', label: 'All Tasks', icon: CheckSquare },
          { href: '/parties', label: 'Clients & Opponents', icon: User },

          { href: '/diary', label: 'Case Journal', icon: FileText },
          { href: '/billing', label: 'Billing System', icon: ReceiptText },
        ]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(data)
      }
    }
    loadProfile()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card shadow-lg border"
      >
        <Menu className="w-6 h-6" />
      </button>

      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-72 bg-sidebar border-r transition-transform duration-300 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl legal-gradient flex items-center justify-center">
                  <Scale className="w-5 h-5 text-primary-foreground" />
                </div>
                  <span className="font-bold text-lg">Legalies</span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1 rounded hover:bg-sidebar-accent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4">
            <Link href="/cases/new">
              <Button className="w-full h-12 text-base font-semibold legal-gradient hover:opacity-90">
                <Plus className="w-5 h-5 mr-2" />
                Add New Case
              </Button>
            </Link>
          </div>

            <nav className="flex-1 px-3 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all",
                      isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                )
              })}

              {profile?.role === 'admin' && (
                  <Link
                    href="/admin"
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all",
                      pathname === '/admin'
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                      <ShieldCheck className="w-5 h-5" />
                      Admin Dashboard
                    </Link>
              )}
            </nav>


          <div className="p-4 border-t">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-sidebar-accent/50 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{profile?.full_name || 'User'}</p>
                <p className="text-xs text-muted-foreground capitalize">{profile?.role || 'Lawyer'}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      <main className="lg:pl-72 min-h-screen flex flex-col">
          <header className="h-16 border-b bg-background/80 backdrop-blur-md sticky top-0 z-30 px-4 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted"
              >
                <Menu className="w-6 h-6" />
              </button>
              
              <div className="hidden md:block w-full max-w-md">
                <GlobalSearch />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <NotificationBell />
            </div>
          </header>
        <div className="flex-1 p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
