'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Calendar,
  Briefcase,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Plus,
  MessageSquare,
  CheckSquare,
  Search,
  LayoutGrid,
  History
} from 'lucide-react'
import { toast } from 'sonner'
import { CreateTaskModal } from '../tasks/components/create-task-modal'
import { CreateHearingModal } from '@/components/create-hearing-modal'
import { CreateNoteModal } from '@/components/create-note-modal'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

interface DashboardData {
  todayHearings: Array<{
    id: string
    hearing_date: string
    court_room: string
    case: {
      id: string
      case_uid: string
      case_title: string
      court_name: string
      status: string
      assigned_lawyer?: { full_name: string }
    }
  }>
  upcomingHearings: Array<{
    id: string
    hearing_date: string
    court_room: string
    case: {
      id: string
      case_uid: string
      case_title: string
      court_name: string
      status: string
      assigned_lawyer?: { full_name: string }
    }
  }>
  todayTasks: Array<{
    id: string
    title: string
    priority: 'low' | 'medium' | 'high'
    status: 'pending' | 'completed'
    case?: { id: string; case_uid: string; case_title: string }
  }>
  overdueTasks: Array<{
    id: string
    title: string
    priority: 'low' | 'medium' | 'high'
    status: 'pending' | 'completed'
    due_date: string
    case?: { id: string; case_uid: string; case_title: string }
  }>
  recentUpdatedCases: Array<{
    id: string
    case_uid: string
    case_title: string
    status: string
    last_updated_at: string
  }>
  stats: {
    activeCases: number
    totalCases: number
    todayHearingsCount: number
    upcomingHearingsCount: number
    todayTasksCount: number
    overdueTasksCount: number
  }
}

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [hearingModalOpen, setHearingModalOpen] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchDashboard()
    fetchUserRole()
  }, [])

  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserRole(data?.role || null)
    }
  }

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard', {
        credentials: 'include'
      })
      
      if (!res.ok) {
        throw new Error(`API Error: ${res.status}`)
      }

      const text = await res.text()
      const result = text ? JSON.parse(text) : null
      
      if (result?.error || !result?.data) {
        setData({
          todayHearings: [],
          upcomingHearings: [],
          todayTasks: [],
          overdueTasks: [],
          recentUpdatedCases: [],
          stats: {
            activeCases: 0,
            totalCases: 0,
            todayHearingsCount: 0,
            upcomingHearingsCount: 0,
            todayTasksCount: 0,
            overdueTasksCount: 0
          }
        })
      } else {
        setData(result.data)
      }
    } catch {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        fetchDashboard()
        toast.success(newStatus === 'completed' ? 'Task completed!' : 'Task reopened')
      }
    } catch {
      toast.error('Failed to update task')
    }
  }

  const filteredTodayHearings = data?.todayHearings.filter(h =>
    h.case.case_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.case.case_uid.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const filteredTodayTasks = data?.todayTasks.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.case?.case_title.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const filteredOverdueTasks = data?.overdueTasks.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.case?.case_title.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const priorityColors = {
    high: 'bg-destructive/10 text-destructive border-destructive/30',
    medium: 'bg-accent/20 text-accent-foreground border-accent/30',
    low: 'bg-muted text-muted-foreground border-muted-foreground/20'
  }

  if (loading || !data) {
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
          </div>
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Today’s Agenda</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Daily overview of your court hearings and action items
          </p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search agenda..."
            className="pl-10 h-12 bg-muted/50 border-none focus-visible:ring-1"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button
          variant="outline"
          className="h-20 flex-col gap-1 border-dashed hover:border-primary hover:bg-primary/5 transition-all"
          onClick={() => setHearingModalOpen(true)}
        >
          <Calendar className="w-5 h-5 text-destructive" />
          <span className="font-semibold text-sm">Add Hearing</span>
        </Button>
        <Button
          variant="outline"
          className="h-20 flex-col gap-1 border-dashed hover:border-primary hover:bg-primary/5 transition-all"
          onClick={() => setTaskModalOpen(true)}
        >
          <CheckSquare className="w-5 h-5 text-accent" />
          <span className="font-semibold text-sm">Add Task</span>
        </Button>
        <Button
          variant="outline"
          className="h-20 flex-col gap-1 border-dashed hover:border-primary hover:bg-primary/5 transition-all"
          onClick={() => setNoteModalOpen(true)}
        >
          <MessageSquare className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">Add Journal Entry</span>
        </Button>
        <Link href="/cases/new" className="h-full">
          <Button
            className="w-full h-20 flex-col gap-1 legal-gradient shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5 text-white" />
            <span className="font-semibold text-sm text-white">Add New Case</span>
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Urgent Alerts / Overdue Tasks */}
          {data.overdueTasks.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
              <CardHeader className="pb-3 border-b border-amber-200/50 dark:border-amber-900/50">
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                  Action Required: Overdue Tasks
                  <Badge className="ml-2 bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-300">{data.stats.overdueTasksCount}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-amber-100 dark:divide-amber-900/50">
                  {filteredOverdueTasks?.map((task) => (
                    <div key={task.id} className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={false}
                          onCheckedChange={() => toggleTaskStatus(task.id, 'pending')}
                          className="mt-1 border-amber-400 data-[state=checked]:bg-amber-600"
                        />
                        <div>
                          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-mono font-medium">Overdue: {format(parseISO(task.due_date), 'MMM d')}</span>
                            {task.case && (
                              <Link href={`/cases/${task.case.id}`} className="text-[10px] text-primary hover:underline font-medium">
                                {task.case.case_title}
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge className={`${priorityColors[task.priority]} shrink-0 text-[10px]`} variant="outline">
                        {task.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hearings Today */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-destructive" />
                  Hearings Today
                  <Badge variant="secondary" className="ml-2 bg-destructive/10 text-destructive border-none">{data.stats.todayHearingsCount}</Badge>
                </CardTitle>
                <Link href="/calendar">
                  <Button variant="ghost" size="sm" className="text-xs">
                    View Calendar
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTodayHearings.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-muted-foreground text-sm">No hearings scheduled yet. Add one to track the next court date.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredTodayHearings?.map((hearing) => (
                    <Link key={hearing.id} href={`/cases/${hearing.case.id}`}>
                      <div className="p-4 hover:bg-muted/50 transition-colors flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{hearing.case.case_title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-primary font-mono">{hearing.case.case_uid}</span>
                            <span className="text-[10px] text-muted-foreground truncate">{hearing.case.court_name}</span>
                            {hearing.court_room && <span className="text-[10px] text-muted-foreground">• {hearing.court_room}</span>}
                          </div>
                        </div>
                        <Badge variant="destructive" className="shrink-0 text-[10px]">Today</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tasks Due Today */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-accent" />
                  Tasks Due Today
                  <Badge variant="secondary" className="ml-2 bg-accent/10 text-accent border-none">{data.stats.todayTasksCount}</Badge>
                </CardTitle>
                <Link href="/tasks">
                  <Button variant="ghost" size="sm" className="text-xs">
                    All Tasks
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTodayTasks.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-muted-foreground text-sm">No tasks due today. You’re all caught up.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredTodayTasks?.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors"
                    >
                      <Checkbox
                        checked={task.status === 'completed'}
                        onCheckedChange={() => toggleTaskStatus(task.id, task.status)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                          {task.title}
                        </p>
                        {task.case && (
                          <Link href={`/cases/${task.case.id}`} className="text-[10px] text-primary hover:underline mt-1 inline-block">
                            {task.case.case_title}
                          </Link>
                        )}
                      </div>
                      <Badge className={`${priorityColors[task.priority]} shrink-0 text-[10px]`} variant="outline">
                        {task.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-muted/20 border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active Cases</span>
                <span className="font-bold">{data.stats.activeCases}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Today's Hearings</span>
                <span className="font-bold text-destructive">{data.stats.todayHearingsCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pending Tasks</span>
                <span className="font-bold text-accent">{data.stats.todayTasksCount + data.stats.overdueTasksCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                Recently Updated
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.recentUpdatedCases.length === 0 ? (
                <p className="text-muted-foreground text-center py-6 text-xs">No recent activity</p>
              ) : (
                <div className="divide-y">
                  {data.recentUpdatedCases?.map((c) => (
                    <Link key={c.id} href={`/cases/${c.id}`}>
                      <div className="p-3 hover:bg-muted/50 transition-colors">
                        <p className="text-xs font-semibold truncate">{c.case_title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-primary font-mono">{c.case_uid}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(parseISO(c.last_updated_at), 'MMM d')}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateHearingModal
        open={hearingModalOpen}
        onOpenChange={setHearingModalOpen}
        onSuccess={fetchDashboard}
      />
      <CreateTaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        onSuccess={fetchDashboard}
      />
      <CreateNoteModal
        open={noteModalOpen}
        onOpenChange={setNoteModalOpen}
        onSuccess={fetchDashboard}
      />
    </div>
  )
}
