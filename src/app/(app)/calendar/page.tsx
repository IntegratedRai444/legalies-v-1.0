'use client'

import { useEffect, useState, useCallback } from 'react'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths 
} from 'date-fns'
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Briefcase,
  User,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'sonner'

interface CalendarEvent {
  id: string
  type: 'hearing' | 'task'
  title: string
  date: string
  location?: string
  purpose?: string
  priority?: 'low' | 'medium' | 'high'
  status?: 'pending' | 'done'
  lawyer?: string
  case_id?: string
  case_uid?: string
}

export default function GlobalCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const start = format(startOfWeek(startOfMonth(currentMonth)), 'yyyy-MM-dd')
    const end = format(endOfWeek(endOfMonth(currentMonth)), 'yyyy-MM-dd')
    
    try {
      const res = await fetch(`/api/calendar?start_date=${start}&end_date=${end}`)
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        setEvents(Array.isArray(data.data) ? data.data : [])
      }
    } catch {
      toast.error('Failed to fetch calendar events')
    } finally {
      setLoading(false)
    }
  }, [currentMonth])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const goToToday = () => {
    setCurrentMonth(new Date())
    setSelectedDay(new Date())
  }

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
  })

  const getEventsForDay = (day: Date) => {
    return Array.isArray(events) ? events.filter(event => isSameDay(new Date(event.date), day)) : []
  }

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : []

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Firm Calendar</h1>
          <p className="text-muted-foreground mt-1">Unified view of all hearings and tasks across the firm</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
          <div className="flex items-center border rounded-lg overflow-hidden bg-card">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-9 w-9 border-r rounded-none">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-4 font-semibold text-sm min-w-[140px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-9 w-9 border-l rounded-none">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-3 flex flex-col min-h-0">
          <div className="grid grid-cols-7 border-x border-t rounded-t-xl bg-muted/50">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="py-2 text-center text-xs font-semibold text-muted-foreground border-r last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 border flex-1 rounded-b-xl overflow-hidden bg-card min-h-[500px]">
            {days.map((day, i) => {
              const dayEvents = getEventsForDay(day)
              const isToday = isSameDay(day, new Date())
              const isSelected = selectedDay && isSameDay(day, selectedDay)
              const isCurrentMonth = isSameMonth(day, currentMonth)

              return (
                <div 
                  key={day.toString()}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "min-h-[100px] p-2 border-r border-b cursor-pointer transition-all hover:bg-muted/50",
                    !isCurrentMonth && "bg-muted/20 text-muted-foreground/50",
                    isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/20",
                    (i + 1) % 7 === 0 && "border-r-0"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={cn(
                      "text-sm font-semibold flex items-center justify-center w-7 h-7 rounded-full",
                      isToday && "bg-primary text-primary-foreground",
                      !isToday && isSelected && "bg-muted text-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {Array.isArray(dayEvents) && dayEvents.filter(e => e.type === 'hearing').length > 0 && (
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      )}
                      {Array.isArray(dayEvents) && dayEvents.filter(e => e.type === 'task').length > 0 && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    {Array.isArray(dayEvents) && dayEvents.slice(0, 3).map(event => (
                      <div 
                        key={event.id}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded border truncate font-medium",
                          event.type === 'hearing' 
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20" 
                            : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                        )}
                      >
                        {event.title}
                      </div>
                    ))}
                    {Array.isArray(dayEvents) && dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground pl-1">
                        + {dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 min-h-0">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="py-4 px-6 border-b">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{selectedDay ? format(selectedDay, 'MMMM d, yyyy') : 'Select a day'}</span>
                {selectedDayEvents.length > 0 && (
                  <Badge variant="secondary">{selectedDayEvents.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0">
              <ScrollArea className="h-full px-6 py-4">
                {Array.isArray(selectedDayEvents) && selectedDayEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <CalendarIcon className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm">No events scheduled for this day</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.isArray(selectedDayEvents) && selectedDayEvents.map(event => (
                      <div 
                        key={event.id} 
                        className={cn(
                          "p-4 rounded-xl border-l-4 bg-muted/30 hover:bg-muted/50 transition-colors border",
                          event.type === 'hearing' ? "border-l-amber-500" : "border-l-blue-500"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Badge variant="outline" className={cn(
                            "text-[10px] uppercase tracking-wider font-bold",
                            event.type === 'hearing' ? "text-amber-600 bg-amber-50" : "text-blue-600 bg-blue-50"
                          )}>
                            {event.type}
                          </Badge>
                          {event.priority && (
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {event.priority}
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-semibold text-sm mb-2 leading-snug">
                          {event.title}
                        </h4>
                        
                        <div className="space-y-1.5 text-xs text-muted-foreground">
                          {event.type === 'hearing' && event.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{event.location}</span>
                            </div>
                          )}
                          {event.lawyer && (
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5" />
                              <span>{event.lawyer}</span>
                            </div>
                          )}
                          {event.case_id && (
                            <Link 
                              href={`/cases/${event.case_id}`}
                              className="flex items-center gap-2 text-primary hover:underline"
                            >
                              <Briefcase className="w-3.5 h-3.5" />
                              <span>{event.case_uid || 'View Case'}</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h4 className="text-sm font-semibold mb-2">Legend</h4>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded bg-amber-500" />
                <span>Hearings</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span>Tasks & Reminders</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
