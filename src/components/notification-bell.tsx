'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Bell, Check, Clock, Info, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  is_read: boolean
  link?: string
  created_at: string
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const supabase = createClient()

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setNotifications(data)
          setUnreadCount(data.filter((n: Notification) => !n.is_read).length)
        } else {
          setNotifications([])
          setUnreadCount(0)
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()

    // Subscribe to real-time notifications
    const channel = supabase
      .channel('notifications_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotification = payload.new as Notification
          // Show toast for new notification
          toast(newNotification.title, {
            description: newNotification.message,
            action: newNotification.link ? {
              label: 'View',
              onClick: () => window.location.href = newNotification.link!
            } : undefined
          })
          fetchNotifications()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          fetchNotifications()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          fetchNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchNotifications])

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_read: true }),
      })
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true }),
      })
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-warning" />
      case 'error': return <XCircle className="w-4 h-4 text-destructive" />
      case 'success': return <CheckCircle2 className="w-4 h-4 text-success" />
      default: return <Info className="w-4 h-4 text-info" />
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-sidebar-accent">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground border-2 border-background"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 shadow-2xl border-sidebar-border">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-base">Notifications</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/10"
              onClick={markAllAsRead}
            >
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Bell className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1">We'll notify you when something important happens.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div 
                  key={n.id}
                  className={cn(
                    "flex gap-3 p-4 border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer relative group",
                    !n.is_read && "bg-primary/5"
                  )}
                  onClick={() => {
                    if (!n.is_read) markAsRead(n.id)
                    if (n.link) window.location.href = n.link
                  }}
                >
                  <div className="mt-1 flex-shrink-0">
                    {getTypeIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm font-semibold leading-tight", !n.is_read ? "text-foreground" : "text-muted-foreground")}>
                        {n.title}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
          {notifications.length > 0 && (
            <div className="p-2 border-t text-center space-y-1">
              <Link href="/notifications" onClick={() => setOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full text-xs text-primary hover:text-primary hover:bg-primary/10">
                  View all notifications
                </Button>
              </Link>
              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          )}

      </DropdownMenuContent>
    </DropdownMenu>
  )
}
