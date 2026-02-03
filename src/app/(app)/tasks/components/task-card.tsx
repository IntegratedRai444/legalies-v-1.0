'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, Clock, MoreVertical, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { Task } from '@/lib/types'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface TaskCardProps {
  task: Task
  onUpdate: () => void
}

export function TaskCard({ task, onUpdate }: TaskCardProps) {
  const [loading, setLoading] = useState(false)

  const toggleStatus = async () => {
    setLoading(true)
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        toast.success(`Task marked as ${newStatus}`)
        onUpdate()
      }
    } catch (error) {
      toast.error('Failed to update task')
    } finally {
      setLoading(false)
    }
  }

  const deleteTask = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return
    
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        toast.success('Task deleted')
        onUpdate()
      }
    } catch (error) {
      toast.error('Failed to delete task')
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700'
      case 'medium': return 'bg-amber-100 text-amber-700'
      case 'low': return 'bg-blue-100 text-blue-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <Card className={`group transition-all hover:shadow-md ${task.status === 'completed' ? 'bg-muted/50 opacity-75' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 rounded-full mt-1 shrink-0" 
            onClick={toggleStatus}
            disabled={loading}
          >
            {task.status === 'completed' ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
          </Button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className={`font-medium truncate ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                {task.title}
              </h4>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-destructive" onClick={deleteTask}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {task.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1 mb-2">
                {task.description}
              </p>
            )}
            
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <Badge variant="secondary" className={`text-[10px] uppercase font-bold tracking-wider ${getPriorityColor(task.priority)}`}>
                {task.priority}
              </Badge>
              
              {task.due_date && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Due {format(new Date(task.due_date), 'MMM d, yyyy')}</span>
                </div>
              )}
              
              {task.case && (
                <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                  <span className="truncate max-w-[150px]">{task.case.case_title}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
