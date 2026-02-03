'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, Clock, Info, AlertTriangle, XCircle, CheckCircle2, Trash2, Calendar, ClipboardCheck, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success' | 'hearing' | 'task' | 'overdue'
  is_read: boolean
  link?: string
  created_at: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchNotifications()

    // Subscribe to real-time notifications
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotification = payload.new as Notification
          setNotifications((prev) => [newNotification, ...prev])
          toast.info(`New notification: ${newNotification.title}`)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

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
      }
    } catch (error) {
      toast.error('Failed to update notification')
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
        toast.success('All notifications marked as read')
      }
    } catch (error) {
      toast.error('Failed to update notifications')
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-5 h-5 text-warning" />
      case 'error': return <XCircle className="w-5 h-5 text-destructive" />
      case 'success': return <CheckCircle2 className="w-5 h-5 text-success" />
      case 'hearing': return <Calendar className="w-5 h-5 text-primary" />
      case 'task': return <ClipboardCheck className="w-5 h-5 text-info" />
      case 'overdue': return <Clock className="w-5 h-5 text-warning" />
      default: return <Info className="w-5 h-5 text-info" />
    }
  }


  const groupNotifications = (notifs: Notification[]) => {
    const groups: Record<string, Notification[]> = {}
    notifs.forEach(n => {
      const date = format(new Date(n.created_at), 'yyyy-MM-dd')
      if (!groups[date]) groups[date] = []
      groups[date].push(n)
    })
    return groups
  }

  const grouped = groupNotifications(notifications)

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-2 text-lg">Stay updated with case changes and firm activity.</p>
        </div>
        <div className="flex items-center gap-3">
          {notifications.some(n => !n.is_read) && (
            <Button variant="outline" size="lg" onClick={markAllAsRead} className="h-12">
              <Check className="w-4 h-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-10">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-24 px-4 text-center">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                <Bell className="w-10 h-10 text-muted-foreground opacity-20" />
              </div>
              <h3 className="text-xl font-semibold">No notifications yet</h3>
              <p className="text-muted-foreground max-w-[300px] mt-2">
                We'll notify you when there are updates to your cases or assigned tasks.
              </p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground sticky top-0 bg-background/80 backdrop-blur-sm py-2 z-10">
                {format(new Date(date), 'MMMM d, yyyy')}
              </h3>
              <div className="grid gap-3">
                {items?.map((n) => (
                  <Card
                    key={n.id}
                    className={cn(
                      "transition-all hover:shadow-md cursor-pointer border-none shadow-sm overflow-hidden group",
                      !n.is_read ? "bg-gradient-to-r from-primary/5 to-transparent border-l-4 border-l-primary" : "bg-muted/30"
                    )}
                    onClick={() => {
                      if (!n.is_read) markAsRead(n.id)
                      if (n.link) router.push(n.link)
                    }}
                  >
                    <CardContent className="p-5 flex gap-5">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                        n.type === 'warning' ? "bg-yellow-100 text-yellow-600" :
                          n.type === 'error' ? "bg-red-100 text-red-600" :
                            n.type === 'success' ? "bg-green-100 text-green-600" :
                              n.type === 'hearing' ? "bg-primary/10 text-primary" :
                                n.type === 'task' ? "bg-blue-100 text-blue-600" :
                                  n.type === 'overdue' ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-600"
                      )}>
                        {getTypeIcon(n.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-1">
                          <h4 className={cn("text-lg font-bold", !n.is_read ? "text-foreground" : "text-muted-foreground")}>
                            {n.title}
                          </h4>
                          <span className="text-xs text-muted-foreground whitespace-nowrap pt-1">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className={cn("text-base leading-relaxed line-clamp-2", !n.is_read ? "text-muted-foreground" : "text-muted-foreground/70")}>
                          {n.message}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
