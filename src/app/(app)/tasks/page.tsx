'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, ListFilter, Calendar, Clock, AlertTriangle, Filter } from 'lucide-react'
import { Task } from '@/lib/types'
import { TaskCard } from './components/task-card'
import { CreateTaskModal } from './components/create-task-modal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { format, addDays, isToday as isDateToday, isPast } from 'date-fns'
import { Badge } from '@/components/ui/badge'

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'overdue'>('all')

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/tasks')
      const { data, error } = await res.json()
      if (!error && res.ok) {
        setTasks(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const filteredTasks = tasks.filter(t => {
    if (!t.due_date) return filter === 'all'
    const isOverdue = isPast(new Date(t.due_date)) && !isDateToday(new Date(t.due_date)) && t.status !== 'completed'

    if (filter === 'today') return t.due_date === todayStr && t.status !== 'completed'
    if (filter === 'overdue') return isOverdue
    if (filter === 'week') {
      const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd')
      return t.due_date >= todayStr && t.due_date <= nextWeek && t.status !== 'completed'
    }
    return true
  })

  const pendingTasks = filteredTasks.filter(t => t.status !== 'completed')
  const completedTasks = filteredTasks.filter(t => t.status === 'completed')

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">All Tasks</h1>
          <p className="text-muted-foreground mt-2 text-lg">Track and manage all your legal action items</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="legal-gradient h-12 px-6 shadow-md">
          <Plus className="w-5 h-5 mr-2" />
          Add Task
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-muted/30 p-1.5 rounded-2xl w-fit">
        <Button
          variant={filter === 'all' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setFilter('all')}
          className="rounded-xl px-4"
        >
          All Items
        </Button>
        <Button
          variant={filter === 'today' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setFilter('today')}
          className="rounded-xl px-4"
        >
          Due Today
        </Button>
        <Button
          variant={filter === 'week' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setFilter('week')}
          className="rounded-xl px-4"
        >
          This Week
        </Button>
        <Button
          variant={filter === 'overdue' ? 'destructive' : 'ghost'}
          size="sm"
          onClick={() => setFilter('overdue')}
          className={`rounded-xl px-4 ${filter === 'overdue' ? '' : 'text-destructive'}`}
        >
          Overdue
        </Button>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/50 p-1 rounded-xl h-11">
            <TabsTrigger value="pending" className="rounded-lg px-6 h-9">
              Pending
              <Badge variant="secondary" className="ml-2 bg-background/50">{pendingTasks.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="rounded-lg px-6 h-9">
              Completed
              <Badge variant="secondary" className="ml-2 bg-background/50">{completedTasks.length}</Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pending" className="mt-0 focus-visible:outline-none">
          {loading ? (
            <TaskSkeleton />
          ) : pendingTasks.length === 0 ? (
            <EmptyState
              message={filter === 'all' ? "No pending tasks found." : `No pending tasks found for this filter.`}
              onCreate={() => setShowCreateModal(true)}
              type={filter}
            />
          ) : (
            <div className="grid gap-3">
              {pendingTasks?.map(task => (
                <TaskCard key={task.id} task={task} onUpdate={fetchTasks} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-0 focus-visible:outline-none">
          {loading ? (
            <TaskSkeleton />
          ) : completedTasks.length === 0 ? (
            <EmptyState message="No completed tasks yet." onCreate={() => setShowCreateModal(true)} />
          ) : (
            <div className="grid gap-3">
              {completedTasks?.map(task => (
                <TaskCard key={task.id} task={task} onUpdate={fetchTasks} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateTaskModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={fetchTasks}
      />
    </div>
  )
}

function TaskSkeleton() {
  return (
    <div className="grid gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 w-full rounded-xl border bg-card p-4 flex gap-4">
          <Skeleton className="h-6 w-6 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ message, onCreate, type = 'all' }: { message: string, onCreate: () => void, type?: string }) {
  const getIcon = () => {
    switch (type) {
      case 'today': return <Clock className="h-8 w-8" />
      case 'overdue': return <AlertTriangle className="h-8 w-8" />
      default: return <ListFilter className="h-8 w-8" />
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed rounded-3xl bg-muted/5 text-center">
      <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-6 text-muted-foreground/40">
        {getIcon()}
      </div>
      <h3 className="text-xl font-bold">All caught up!</h3>
      <p className="text-muted-foreground max-w-[300px] mt-2 mb-8">
        {message === "No pending tasks found." ? "You don't have any pending tasks at the moment." : message}
      </p>
      <Button variant="outline" onClick={onCreate} className="rounded-xl h-11 px-6">
        <Plus className="h-4 w-4 mr-2" />
        Create New Task
      </Button>
    </div>
  )
}
