'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  ArrowLeft,
  Calendar,
  Building,
  Users,
  Phone,
  MapPin,
  Plus,
  FileText,
  Clock,
  Upload,
  Download,
  Trash2,
  Pencil,
  CheckCircle2,
  History,
  MessageSquare,
  CheckSquare,
  Receipt,
  ChevronRight,
  Printer
} from 'lucide-react'
import { CaseWithParties, Hearing, DiaryNote, Task, CaseDocument, QUICK_TEMPLATES, CASE_TYPES, CASE_STATUSES, CASE_STAGES } from '@/lib/types'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { CreateTaskModal } from '../../tasks/components/create-task-modal'
import { TaskCard } from '../../tasks/components/task-card'
import { ExpensesTab } from './components/expenses-tab'
import { BillingTab } from './components/billing-tab'
import { cn } from '@/lib/utils'
import { DialogDescription } from '@/components/ui/dialog'
import { CreateHearingModal } from '@/components/create-hearing-modal'

type TimelineItem = {
  id: string;
  type: 'hearing' | 'note' | 'document';
  date: string;
  title: string;
  content: string;
  metadata?: any;
}

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [caseData, setCaseData] = useState<CaseWithParties | null>(null)
  const [hearings, setHearings] = useState<Hearing[]>([])
  const [documents, setDocuments] = useState<CaseDocument[]>([])
  const [diaryNotes, setDiaryNotes] = useState<DiaryNote[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [advocates, setAdvocates] = useState<any[]>([])
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('Evidence')
  const [saving, setSaving] = useState(false)
  const [hearingDialogOpen, setHearingDialogOpen] = useState(false)

  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [newHearing, setNewHearing] = useState<Partial<Hearing>>({
    hearing_date: format(new Date(), 'yyyy-MM-dd'),
    court_room: '',
    hearing_type: '',
    opponent_appearance: 'present',
    outcome: ''
  })
  const [newNote, setNewNote] = useState<Partial<DiaryNote>>({
    note_date: format(new Date(), 'yyyy-MM-dd'),
    note_text: '',
    priority: 'medium'
  })
  const [editForm, setEditForm] = useState({
    case_title: '',
    case_type: '',
    court_name: '',
    court_city: '',
    court_state: '',
    status: 'Active' as CaseWithParties['status'],
    stage: 'Notice' as CaseWithParties['stage'],
    priority: 'Routine',
    next_hearing_date: '',
    agreed_fee: '',
    assigned_lawyer_id: ''
  })

  const [editOutcomeDialogOpen, setEditOutcomeDialogOpen] = useState(false)
  const [editingHearing, setEditingHearing] = useState<Hearing | null>(null)


  useEffect(() => {
    fetchCase()
    fetchHearings()
    fetchDocuments()
    fetchDiaryNotes()
    fetchTasks()
    fetchRole()
    fetchAdvocates()
  }, [id])

  const fetchRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setUserRole(data?.role || 'advocate')
    }
  }

  const fetchAdvocates = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'advocate')
    setAdvocates(data || [])
  }

  useEffect(() => {
    const items: TimelineItem[] = []

    hearings.forEach(h => items.push({
      id: h.id,
      type: 'hearing',
      date: h.hearing_date,
      title: `Hearing: ${h.hearing_type || 'General Hearing'}`,
      content: h.outcome || h.notes || '',
      metadata: h
    }))

    diaryNotes.forEach(n => items.push({
      id: n.id,
      type: 'note',
      date: n.note_date,
      title: `Note: ${(n.priority || 'medium').toUpperCase()} priority`,
      content: n.note_text,
      metadata: n
    }))

    documents.forEach(d => items.push({
      id: d.id,
      type: 'document',
      date: d.created_at,
      title: `Document Uploaded: ${d.title}`,
      content: '',
      metadata: d
    }))

    setTimeline(items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
  }, [hearings, diaryNotes, documents])

  const fetchCase = async () => {
    try {
      const res = await fetch(`/api/cases/${id}`)
      const data = await res.json()
      setCaseData(data)
      if (data) {
        setEditForm({
          case_title: data.case_title,
          case_type: data.case_type || '',
          court_name: data.court_name || '',
          court_city: data.court_city || '',
          court_state: data.court_state || '',
          status: data.status,
          stage: data.stage,
          priority: data.priority || 'Routine',
          next_hearing_date: data.next_hearing_date || '',
          agreed_fee: data.agreed_fee?.toString() || '',
          assigned_lawyer_id: data.assigned_lawyer_id || ''
        })
      }
    } catch {
      toast.error('Failed to load case')
    } finally {
      setLoading(false)
    }
  }

  const fetchHearings = async () => {
    try {
      const res = await fetch(`/api/cases/${id}/hearings`)
      const data = await res.json()
      if (data.error || !Array.isArray(data)) {
        setHearings([])
      } else {
        setHearings(data)
      }
    } catch {
      console.error('Failed to load hearings')
    }
  }

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/cases/${id}/documents`)
      const data = await res.json()
      if (data.error || !Array.isArray(data)) {
        setDocuments([])
      } else {
        setDocuments(data)
      }
    } catch {
      console.error('Failed to load documents')
    }
  }

  const fetchDiaryNotes = async () => {
    try {
      const res = await fetch(`/api/diary?case_id=${id}`)
      const data = await res.json()
      if (data.error || !Array.isArray(data)) {
        setDiaryNotes([])
      } else {
        setDiaryNotes(data)
      }
    } catch {
      console.error('Failed to load diary notes')
    }
  }

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/tasks?caseId=${id}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setTasks(data)
      }
    } catch {
      console.error('Failed to load tasks')
    }
  }

  const addHearing = async () => {
    if (!newHearing.hearing_date) {
      toast.error('Please select a hearing date')
      return
    }

    try {
      await fetch(`/api/cases/${id}/hearings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHearing)
      })

      toast.success('Hearing added successfully!')
      setHearingDialogOpen(false)
      setNewHearing({
        hearing_date: format(new Date(), 'yyyy-MM-dd'),
        court_room: '',
        hearing_type: '',
        opponent_appearance: 'present',
        outcome: '',
        next_hearing_date: ''
      })
      fetchHearings()
      fetchCase()
    } catch {
      toast.error('Failed to add hearing')
    }
  }

  const updateHearingOutcome = async () => {
    if (!editingHearing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/cases/${id}/hearings/${editingHearing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: editingHearing.outcome
        })
      })

      if (!res.ok) throw new Error()

      toast.success('Hearing outcome updated!')
      setEditOutcomeDialogOpen(false)
      setEditingHearing(null)
      fetchHearings()
      fetchCase()
    } catch {
      toast.error('Failed to update hearing outcome')
    } finally {
      setSaving(false)
    }
  }

  const addNote = async () => {
    if (!newNote.note_text) {
      toast.error('Please enter note text')
      return
    }

    try {
      await fetch(`/api/diary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newNote,
          case_id: id
        })
      })

      toast.success('Note added successfully!')
      setNoteDialogOpen(false)
      setNewNote({
        note_date: format(new Date(), 'yyyy-MM-dd'),
        note_text: '',
        priority: 'medium'
      })
      fetchDiaryNotes()
    } catch {
      toast.error('Failed to add note')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('case-documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('case-documents')
        .getPublicUrl(filePath)

      await fetch(`/api/cases/${id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: file.name,
          file_path: publicUrl,
          category: selectedCategory
        })
      })

      toast.success('Document uploaded!')
      fetchDocuments()
    } catch {
      toast.error('Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  const applyTemplate = (template: string) => {
    setNewHearing({ ...newHearing, outcome: template })
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-32" />
          <div className="h-48 bg-muted rounded-xl" />
          <div className="h-96 bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="p-6 lg:p-8">
        <p>Case not found</p>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    Active: 'bg-green-100 text-green-800 border-green-200',
    Pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Disposed: 'bg-gray-100 text-gray-800 border-gray-200',
    Stay: 'bg-blue-100 text-blue-800 border-blue-200',
    Withdrawn: 'bg-purple-100 text-purple-800 border-purple-200',
    Transferred: 'bg-orange-100 text-orange-800 border-orange-200'
  }

  const getNextAction = () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const todayHearing = hearings.find(h => h.hearing_date === today)
    if (todayHearing && !todayHearing.outcome) {
      return {
        text: `Record outcome for today's hearing`,
        buttonText: "Record Outcome",
        action: () => {
          setEditingHearing(todayHearing)
          setEditOutcomeDialogOpen(true)
        },
        icon: <Calendar className="w-4 h-4" />
      }
    }

    const pastHearingWithoutOutcome = hearings
      .filter(h => new Date(h.hearing_date) < new Date() && !h.outcome)
      .sort((a, b) => new Date(b.hearing_date).getTime() - new Date(a.hearing_date).getTime())[0]

    if (pastHearingWithoutOutcome) {
      return {
        text: `Record outcome for hearing on ${format(parseISO(pastHearingWithoutOutcome.hearing_date), 'MMM d')}`,
        buttonText: "Record Result",
        action: () => {
          setEditingHearing(pastHearingWithoutOutcome)
          setEditOutcomeDialogOpen(true)
        },
        icon: <Calendar className="w-4 h-4" />
      }
    }

    const pendingTask = tasks.find(t => t.status !== 'completed')
    if (pendingTask) {
      return {
        text: `Complete task: ${pendingTask.title}`,
        buttonText: "View Task",
        action: () => {
          const el = document.getElementById('tasks-section')
          if (el) el.scrollIntoView({ behavior: 'smooth' })
        },
        icon: <CheckSquare className="w-4 h-4" />
      }
    }

    return {
      text: "No immediate action required",
      buttonText: "Take Action",
      action: null,
      icon: <CheckCircle2 className="w-4 h-4" />
    }
  }

  const nextAction = getNextAction()

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to Cases
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(`/cases/${id}/print`, '_blank')} className="h-9 px-4">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)} className="h-9 px-4">
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3 border-none shadow-sm bg-card overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn(statusColors[caseData.status], "px-2 py-0 h-6 border")}>{caseData.status}</Badge>
                  <Badge variant="secondary" className="px-2 py-0 h-6">{caseData.stage}</Badge>
                  {caseData.priority && (
                    <Badge
                      variant={caseData.priority === 'Urgent' ? 'destructive' : 'outline'}
                      className="px-2 py-0 h-6"
                    >
                      {caseData.priority}
                    </Badge>
                  )}
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{caseData.case_title}</h1>
                  <p className="text-primary font-mono text-lg mt-1">{caseData.case_uid}</p>
                </div>
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Assigned:</span>
                    <span className="font-semibold">{caseData.assigned_lawyer?.full_name || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold truncate max-w-[200px]">
                      {caseData.court_name}
                      {(caseData.court_city || caseData.court_state) && (
                        <span className="text-muted-foreground font-normal ml-1">
                          ({[caseData.court_city, caseData.court_state].filter(Boolean).join(', ')})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-row md:flex-col gap-3 shrink-0">
                <div className="bg-destructive/5 p-4 rounded-2xl border border-destructive/10 text-center min-w-[140px]">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-destructive/70 mb-1">Next Hearing</p>
                  <p className="text-lg font-bold text-destructive">
                    {caseData.next_hearing_date ? format(parseISO(caseData.next_hearing_date), 'MMM d, yyyy') : 'TBD'}
                  </p>
                </div>
                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 text-center min-w-[140px]">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-primary/70 mb-1">Pending Tasks</p>
                  <p className="text-lg font-bold text-primary">
                    {tasks.filter(t => t.status !== 'completed').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-primary/[0.03] px-6 py-4 border-t flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  {nextAction.icon}
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-primary/60 tracking-wider">Next Required Action</p>
                  <p className="text-sm font-bold">{nextAction.text}</p>
                </div>
              </div>
              {nextAction.action && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-9 gap-2 shadow-sm"
                  onClick={nextAction.action}
                >
                  {nextAction.buttonText} <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-card">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y text-sm">
              {timeline?.slice(0, 4).map((item) => (
                <div key={`${item.type}-${item.id}`} className="p-3.5 hover:bg-muted/30 transition-colors">
                  <p className="font-semibold truncate text-[13px]">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {format(parseISO(item.date), 'MMM d, h:mm a')}
                  </p>
                </div>
              ))}
              {timeline.length === 0 && <p className="p-8 text-center text-xs text-muted-foreground italic">No recent activity</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-11 w-full lg:w-auto">
          <TabsTrigger value="overview" className="rounded-lg px-6 h-9 gap-2">
            <History className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="hearings" className="rounded-lg px-6 h-9 gap-2">
            <Calendar className="w-4 h-4" />
            Hearings
          </TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-lg px-6 h-9 gap-2">
            <CheckSquare className="w-4 h-4" />
            Action Items
          </TabsTrigger>
          <TabsTrigger value="notes" className="rounded-lg px-6 h-9 gap-2">
            <FileText className="w-4 h-4" />
            Case Journal
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-lg px-6 h-9 gap-2">
            <Upload className="w-4 h-4" />
            Documents
          </TabsTrigger>
          {userRole !== 'admin' && (
            <>
              <TabsTrigger value="billing" className="rounded-lg px-6 h-9 gap-2">
                <Receipt className="w-4 h-4" />
                Billing
              </TabsTrigger>
              <TabsTrigger value="expenses" className="rounded-lg px-6 h-9 gap-2">
                <Plus className="w-4 h-4" />
                Expenses
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="overview" className="focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 shadow-sm border-none">
              <CardHeader>
                <CardTitle>Case Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed rounded-3xl">
                    <History className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground">No activity records found</p>
                  </div>
                ) : (
                  <div className="relative pl-8 border-l-2 border-muted/50 space-y-10 ml-4">
                    {timeline?.map((item) => (
                      <div key={`${item.type}-${item.id}`} className="relative">
                        <div className="absolute -left-[41px] top-1 w-5 h-5 rounded-full bg-card border-2 border-primary shadow-sm flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        </div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            {format(parseISO(item.date), 'MMMM d, yyyy')}
                          </span>
                          <Badge variant="outline" className="text-[9px] uppercase font-bold h-4">
                            {item.type}
                          </Badge>
                        </div>
                        <h4 className="font-bold text-base">{item.title}</h4>
                        {item.content && (
                          <p className="text-sm text-muted-foreground mt-2 leading-relaxed bg-muted/30 p-4 rounded-2xl border border-muted/50">
                            {item.content}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="shadow-sm border-none">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Parties Involved</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Clients</p>
                    {caseData.clients?.map(c => (
                      <div key={c.id} className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{c.party.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold">{c.role_label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Opponents</p>
                    {caseData.opponents?.map(o => (
                      <div key={o.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{o.party.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold">{o.role_label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="hearings" className="focus-visible:outline-none">
          <Card className="shadow-sm border-none">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle>Hearing Records</CardTitle>
                <Button className="legal-gradient h-10" onClick={() => setHearingDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Update
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {hearings.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed rounded-3xl">
                  <Calendar className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground">No hearings recorded for this case</p>
                </div>
              ) : (
                <div className="relative pl-8 border-l-2 border-muted/50 space-y-8 ml-4">
                  {hearings?.map((h) => (
                    <div key={h.id} className="relative">
                      <div className="absolute -left-[41px] top-1 w-5 h-5 rounded-full bg-card border-2 border-destructive shadow-sm flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                      </div>
                      <div className="p-6 border rounded-2xl bg-card hover:shadow-md transition-shadow group">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <p className="text-base font-bold">
                              {format(parseISO(h.hearing_date), 'MMMM d, yyyy')}
                            </p>
                            <div className="flex flex-wrap items-center gap-4 mt-2">
                              {h.court_room && (
                                <p className="text-xs flex items-center gap-1.5 text-muted-foreground font-medium">
                                  <MapPin className="w-3.5 h-3.5" />
                                  {h.court_room}
                                </p>
                              )}
                              {h.hearing_type && (
                                <p className="text-xs flex items-center gap-1.5 text-muted-foreground font-medium">
                                  <FileText className="w-3.5 h-3.5" />
                                  {h.hearing_type}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-bold uppercase px-2 h-5">
                              {h.opponent_appearance || 'present'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setEditingHearing(h)
                                setEditOutcomeDialogOpen(true)
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {h.outcome ? (
                          <div className="p-4 bg-muted/30 rounded-xl border border-muted/50 text-sm italic text-foreground/80">
                            {h.outcome}
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 border-dashed"
                            onClick={() => {
                              setEditingHearing(h)
                              setEditOutcomeDialogOpen(true)
                            }}
                          >
                            Add hearing outcome...
                          </Button>
                        )}

                        {/* Next date removed from hearing entity */}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" id="tasks-section" className="focus-visible:outline-none">
          <Card className="shadow-sm border-none">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle>Action Items</CardTitle>
                <Button className="legal-gradient h-10" onClick={() => setTaskModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed rounded-3xl">
                  <CheckSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground">No pending tasks for this case</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {tasks?.map((task) => (
                    <TaskCard key={task.id} task={task} onUpdate={fetchTasks} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="focus-visible:outline-none">
          <Card className="shadow-sm border-none">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle>Case Journal</CardTitle>
                <Button className="legal-gradient h-10" onClick={() => setNoteDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Journal Entry
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {diaryNotes.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed rounded-3xl">
                  <FileText className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground">No notes or reflections yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {diaryNotes?.map((note) => (
                    <div key={note.id} className="p-5 border rounded-2xl bg-card space-y-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant={note.priority === 'high' ? 'destructive' : note.priority === 'medium' ? 'secondary' : 'outline'} className="text-[9px] h-4 uppercase font-bold">
                            {note.priority}
                          </Badge>
                          <span className="text-xs font-bold text-muted-foreground">{format(parseISO(note.note_date), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
                        {note.note_text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="focus-visible:outline-none">
          <Card className="shadow-sm border-none">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle>Case Documents</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[140px] h-10 bg-muted/50 border-none shadow-none">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Evidence">Evidence</SelectItem>
                      <SelectItem value="Pleadings">Pleadings</SelectItem>
                      <SelectItem value="Orders">Orders</SelectItem>
                      <SelectItem value="Internal">Internal</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <label htmlFor="file-upload">
                    <Button asChild className="legal-gradient cursor-pointer h-10 px-4" disabled={uploading}>
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        {uploading ? 'Uploading...' : 'Upload'}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed rounded-3xl">
                  <Upload className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground">No documents uploaded</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents?.map((doc) => (
                    <div key={doc.id} className="p-4 border rounded-2xl bg-card hover:shadow-md transition-shadow group flex flex-col justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{doc.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[9px] font-bold uppercase px-1.5 h-4">{doc.category || 'Evidence'}</Badge>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {format(parseISO(doc.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <a href={doc.file_path} target="_blank" rel="noopener noreferrer" className="w-full">
                        <Button variant="secondary" size="sm" className="w-full h-9 text-xs font-bold gap-2">
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </Button>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="focus-visible:outline-none">
          <BillingTab caseData={caseData} onUpdate={fetchCase} />
        </TabsContent>

        <TabsContent value="expenses" className="focus-visible:outline-none">
          <ExpensesTab caseId={id} />
        </TabsContent>
      </Tabs>

      <CreateTaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        onSuccess={fetchTasks}
        initialCaseId={id}
      />

      <CreateHearingModal
        open={hearingDialogOpen}
        onOpenChange={setHearingDialogOpen}
        onSuccess={() => {
          fetchHearings()
          fetchCase()
        }}
        initialCaseId={id}
      />

      <Dialog open={editOutcomeDialogOpen} onOpenChange={setEditOutcomeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Hearing Outcome</DialogTitle>
            <DialogDescription>
              Update results for hearing on {editingHearing && format(parseISO(editingHearing.hearing_date), 'MMMM d, yyyy')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-3">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Outcome Quick Templates</Label>
              <div className="flex flex-wrap gap-2">
                {QUICK_TEMPLATES.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-[11px] h-7 px-2.5 rounded-lg border-muted-foreground/20"
                    onClick={() => setEditingHearing(prev => prev ? ({ ...prev, outcome: t }) : null)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Internal Outcome / Notes</Label>
              <Textarea
                placeholder="Summarize what happened..."
                value={editingHearing?.outcome || ''}
                onChange={(e) => setEditingHearing(prev => prev ? ({ ...prev, outcome: e.target.value }) : null)}
                rows={4}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Next Hearing Date (TBD if empty)</Label>
              <Input
                type="date"
                {/* Next hearing date input removed */}
                className="h-12 rounded-xl"
              />
            </div>
            <Button
              onClick={updateHearingOutcome}
              className="w-full h-12 legal-gradient shadow-lg"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Case Details</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Case Title *</Label>
              <Input
                value={editForm.case_title}
                onChange={(e) => setEditForm({ ...editForm, case_title: e.target.value })}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label>Case Type</Label>
              <Select
                value={editForm.case_type}
                onValueChange={(v) => setEditForm({ ...editForm, case_type: v })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Court Name</Label>
              <Input
                value={editForm.court_name}
                onChange={(e) => setEditForm({ ...editForm, court_name: e.target.value })}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={editForm.court_city}
                onChange={(e) => setEditForm({ ...editForm, court_city: e.target.value })}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input
                value={editForm.court_state}
                onChange={(e) => setEditForm({ ...editForm, court_state: e.target.value })}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm({ ...editForm, status: v as any })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select
                value={editForm.stage}
                onValueChange={(v) => setEditForm({ ...editForm, stage: v as any })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_STAGES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={editForm.priority}
                onValueChange={(v) => setEditForm({ ...editForm, priority: v })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Routine">Routine</SelectItem>
                  <SelectItem value="High Attention">High Attention</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {userRole !== 'admin' && (
              <div className="space-y-2">
                <Label>Agreed Fee (₹)</Label>
                <Input
                  type="number"
                  value={editForm.agreed_fee}
                  onChange={(e) => setEditForm({ ...editForm, agreed_fee: e.target.value })}
                  className="h-12"
                />
              </div>
            )}

            {userRole === 'admin' && (
              <div className="space-y-2 md:col-span-2">
                <Label>Assigned Lawyer</Label>
                <Select
                  value={editForm.assigned_lawyer_id}
                  onValueChange={(v) => setEditForm({ ...editForm, assigned_lawyer_id: v })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select Lawyer" />
                  </SelectTrigger>
                  <SelectContent>
                    {advocates.map(adv => (
                      <SelectItem key={adv.id} value={adv.id}>{adv.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button
              className="legal-gradient"
              disabled={saving}
              onClick={async () => {
                setSaving(true)
                try {
                  const res = await fetch(`/api/cases/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editForm)
                  })
                  if (!res.ok) throw new Error()
                  toast.success('Case updated')
                  setEditDialogOpen(false)
                  fetchCase()
                } catch {
                  toast.error('Failed to update case')
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Journal Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Journal Entry Date</Label>
              <Input
                type="date"
                value={newNote.note_date}
                onChange={(e) => setNewNote({ ...newNote, note_date: e.target.value })}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={newNote.priority}
                onValueChange={(v) => setNewNote({ ...newNote, priority: v as any })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Journal Entry *</Label>
              <Textarea
                placeholder="Internal journal entries about the case..."
                value={newNote.note_text}
                onChange={(e) => setNewNote({ ...newNote, note_text: e.target.value })}
                rows={5}
              />
            </div>
            <Button onClick={addNote} className="w-full h-12 legal-gradient">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
