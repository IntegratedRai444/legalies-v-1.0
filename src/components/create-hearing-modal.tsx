'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { QUICK_TEMPLATES } from '@/lib/types'
import { toast } from 'sonner'

interface CreateHearingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  initialCaseId?: string
}

export function CreateHearingModal({ open, onOpenChange, onSuccess, initialCaseId }: CreateHearingModalProps) {
  const [loading, setLoading] = useState(false)
  const [cases, setCases] = useState<Array<{ id: string; case_uid: string; case_title: string }>>([])
  const [form, setForm] = useState({
    case_id: initialCaseId || '',
    hearing_date: format(new Date(), 'yyyy-MM-dd'),
    court_room: '',
    hearing_type: '',
    opponent_appearance: 'present',
    outcome: '',
    next_hearing_date: ''
  })

  useEffect(() => {
    if (open && !initialCaseId) {
      fetchCases()
    }
    if (initialCaseId) {
      setForm(f => ({ ...f, case_id: initialCaseId }))
    }
  }, [open, initialCaseId])

  const fetchCases = async () => {
    try {
      const res = await fetch('/api/cases?status=Active')
      const data = await res.json()
      if (Array.isArray(data)) {
        setCases(data)
      }
    } catch {
      console.error('Failed to fetch cases')
    }
  }

  const handleSubmit = async () => {
    if (!form.case_id) {
      toast.error('Please select a case')
      return
    }
    if (!form.hearing_date) {
      toast.error('Please select a hearing date')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/cases/${form.case_id}/hearings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      if (!res.ok) throw new Error()

      toast.success('Hearing added successfully!')
      onOpenChange(false)
      setForm({
        case_id: initialCaseId || '',
        hearing_date: format(new Date(), 'yyyy-MM-dd'),
        court_room: '',
        hearing_type: '',
        opponent_appearance: 'present',
        outcome: '',
        next_hearing_date: ''
      })
      onSuccess?.()
    } catch {
      toast.error('Failed to add hearing')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Hearing Update</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {!initialCaseId && (
            <div className="space-y-2">
              <Label>Select Case *</Label>
              <Select value={form.case_id} onValueChange={(v) => setForm({ ...form, case_id: v })}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select Case" />
                </SelectTrigger>
                <SelectContent>
                  {cases.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.case_uid} - {c.case_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Hearing Date *</Label>
            <Input
              type="date"
              value={form.hearing_date}
              onChange={(e) => setForm({ ...form, hearing_date: e.target.value })}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label>Location / Court Room</Label>
            <Input
              placeholder="e.g., Court Room No. 5"
              value={form.court_room}
              onChange={(e) => setForm({ ...form, court_room: e.target.value })}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label>Purpose</Label>
            <Input
              placeholder="e.g., Arguments, Evidence, etc."
              value={form.hearing_type}
              onChange={(e) => setForm({ ...form, hearing_type: e.target.value })}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label>Opponent Appearance</Label>
            <Select
              value={form.opponent_appearance}
              onValueChange={(v) => setForm({ ...form, opponent_appearance: v })}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="exempted">Exempted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quick Templates</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_TEMPLATES.map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm({ ...form, outcome: t })}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Outcome / Notes</Label>
            <Textarea
              placeholder="What happened in the hearing..."
              value={form.outcome}
              onChange={(e) => setForm({ ...form, outcome: e.target.value })}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Next Hearing Date</Label>
            <Input
              type="date"
              value={form.next_hearing_date}
              onChange={(e) => setForm({ ...form, next_hearing_date: e.target.value })}
              className="h-12"
            />
          </div>
          <Button onClick={handleSubmit} className="w-full h-12 legal-gradient" disabled={loading}>
            {loading ? 'Saving...' : 'Save Hearing Update'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
