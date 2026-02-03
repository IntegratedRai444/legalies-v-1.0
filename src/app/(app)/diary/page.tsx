'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { format, parseISO, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Calendar, Plus, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { DiaryNote } from '@/lib/types'
import { toast } from 'sonner'

export default function DiaryPage() {
  const [notes, setNotes] = useState<DiaryNote[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [cases, setCases] = useState<Array<{ id: string; case_uid: string; case_title: string }>>([])

  const [newNote, setNewNote] = useState({
    note_date: format(new Date(), 'yyyy-MM-dd'),
    note_text: '',
    priority: 'routine' as any,
    case_id: ''
  })

  const fetchNotes = useCallback(async () => {
    const start = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const end = format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')

    try {
      const res = await fetch(`/api/diary?start_date=${start}&end_date=${end}`)
      const data = await res.json()
      if (data.error || !Array.isArray(data)) {
        setNotes([])
      } else {
        setNotes(data)
      }
    } catch {
      toast.error('Failed to load journal')
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  const fetchCases = async () => {
    try {
      const res = await fetch('/api/cases?status=Active')
      const data = await res.json()
      if (data.error || !Array.isArray(data)) {
        setCases([])
      } else {
        setCases(data.map((c: { id: string; case_uid: string; case_title: string }) => ({
          id: c.id,
          case_uid: c.case_uid,
          case_title: c.case_title
        })))
      }
    } catch {
      console.error('Failed to fetch cases')
    }
  }

  useEffect(() => {
    fetchNotes()
    fetchCases()
  }, [fetchNotes])

  const addNote = async () => {
    if (!newNote.note_text.trim()) {
      toast.error('Please enter a note')
      return
    }

    try {
      await fetch('/api/diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newNote,
          case_id: newNote.case_id || null,
          priority: 'routine' // Force routine to remove urgency
        })
      })

      toast.success('Journal entry added!')
      setDialogOpen(false)
      setNewNote({
        note_date: format(new Date(), 'yyyy-MM-dd'),
        note_text: '',
        priority: 'routine' as any,
        case_id: ''
      })
      fetchNotes()
    } catch {
      toast.error('Failed to add entry')
    }
  }

  const goToPreviousWeek = () => setSelectedDate(addDays(selectedDate, -7))
  const goToNextWeek = () => setSelectedDate(addDays(selectedDate, 7))
  const goToToday = () => setSelectedDate(new Date())

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), i)
    return {
      date,
      dateStr: format(date, 'yyyy-MM-dd'),
      dayName: format(date, 'EEE'),
      dayNum: format(date, 'd'),
      isToday: format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
    }
  })

  const getNotesByDate = (dateStr: string) => {
    return notes.filter(n => n.note_date === dateStr)
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Case Journal</h1>
          <p className="text-muted-foreground mt-1">
            Private notes and reflections for your cases
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={goToToday}>Today</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="legal-gradient">
                <Plus className="w-5 h-5 mr-2" />
                Add Journal Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Journal Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newNote.note_date}
                    onChange={(e) => setNewNote({ ...newNote, note_date: e.target.value })}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Journal Entry *</Label>
                  <Textarea
                    placeholder="Record case progress, court observations, or strategy journal entries here."
                    value={newNote.note_text}
                    onChange={(e) => setNewNote({ ...newNote, note_text: e.target.value })}
                    rows={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Link to Case (optional)</Label>
                  <Select value={newNote.case_id} onValueChange={(v) => setNewNote({ ...newNote, case_id: v })}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="No case linked" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No case linked</SelectItem>
                      {cases?.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.case_uid} - {c.case_title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addNote} className="w-full h-12 legal-gradient">
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center justify-between bg-muted/30 p-2 rounded-2xl">
        <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 grid grid-cols-7 gap-2 mx-4">
          {weekDays.map((day) => (
            <div
              key={day.dateStr}
              className={`text-center py-2 px-1 rounded-xl cursor-pointer transition-colors ${day.isToday
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'hover:bg-muted'
                }`}
              onClick={() => {
                setNewNote({ ...newNote, note_date: day.dateStr })
                setDialogOpen(true)
              }}
            >
              <p className="text-[10px] font-medium uppercase opacity-80">{day.dayName}</p>
              <p className="text-base font-bold">{day.dayNum}</p>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="icon" onClick={goToNextWeek}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
          {[1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
          {weekDays.map((day) => {
            const dayNotes = getNotesByDate(day.dateStr)
            return (
              <Card key={day.dateStr} className={`border-none shadow-sm ${day.isToday ? 'ring-1 ring-primary/20 bg-primary/5' : 'bg-card'}`}>
                <CardHeader className="pb-2 p-4">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>{day.dayName} {day.dayNum}</span>
                    {dayNotes.length > 0 && (
                      <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] text-foreground">
                        {dayNotes.length}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 space-y-2">
                  {dayNotes.length === 0 ? (
                    <div className="text-center py-8 opacity-40">
                      <p className="text-[10px]">No entries</p>
                    </div>
                  ) : (
                    dayNotes?.map((note) => (
                      <div
                        key={note.id}
                        className="p-3 rounded-xl bg-background border border-border/50 shadow-sm space-y-2"
                      >
                        <p className="text-xs leading-relaxed text-foreground/80">
                          {note.note_text}
                        </p>
                        {note.case && (
                          <Link href={`/cases/${note.case.id}`} className="text-[10px] font-semibold text-primary hover:underline block truncate">
                            {note.case.case_uid}
                          </Link>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {notes.length === 0 && !loading && (
        <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">No notes yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-2">
            Record case progress, court observations, or strategy notes here. Use the Case Journal to maintain a private log of your work.
          </p>
        </div>
      )}
    </div>
  )
}
