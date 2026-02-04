'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, ArrowRight, Check, Plus, X, Upload, FileText } from 'lucide-react'
import { CASE_TYPES, CASE_STATUSES, CASE_STAGES, PARTY_ROLES } from '@/lib/types'
import { toast } from 'sonner'

interface PartyInput {
  name: string
  phone: string
  address: string
  role_label: string
}

export default function NewCasePage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        setUserRole(data?.role || null)
      }
    }
    fetchUser()
  }, [supabase])

  const [caseData, setCaseData] = useState({
    case_title: '',
    case_type: '',
    court_name: '',
    court_city: '',
    court_state: '',
    filing_date: '',
    status: 'Active' as const,
    stage: 'Notice' as const,
    next_hearing_date: '',
    agreed_fee: '',
    priority: 'Routine'
  })

  const [clients, setClients] = useState<PartyInput[]>([
    { name: '', phone: '', address: '', role_label: 'Petitioner' }
  ])
  const [opponents, setOpponents] = useState<PartyInput[]>([
    { name: '', phone: '', address: '', role_label: 'Respondent' }
  ])
  const [documents, setDocuments] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  const addClient = () =>
    setClients([...clients, { name: '', phone: '', address: '', role_label: 'Petitioner' }])

  const removeClient = (i: number) =>
    setClients(clients.filter((_, idx) => idx !== i))

  const updateClient = (i: number, field: keyof PartyInput, value: string) => {
    const updated = [...clients]
    updated[i][field] = value
    setClients(updated)
  }

  const addOpponent = () =>
    setOpponents([...opponents, { name: '', phone: '', address: '', role_label: 'Respondent' }])

  const removeOpponent = (i: number) =>
    setOpponents(opponents.filter((_, idx) => idx !== i))

  const updateOpponent = (i: number, field: keyof PartyInput, value: string) => {
    const updated = [...opponents]
    updated[i][field] = value
    setOpponents(updated)
  }

  const handleSubmit = async () => {
    if (!caseData.case_title.trim()) {
      toast.error('Please enter a case title')
      return
    }
    if (!clients.some(c => c.name.trim())) {
      toast.error('Please add at least one client')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...caseData,
          clients: clients.filter(c => c.name.trim()),
          opponents: opponents.filter(o => o.name.trim())
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to create case')
      }

      const result = await res.json()
      const caseId = result.data.id
      
      // Upload documents if any were selected
      if (documents.length > 0) {
        setUploading(true)
        toast.info('Uploading documents...')
        
        for (const file of documents) {
          const formData = new FormData()
          formData.append('file', file)
          
          const uploadRes = await fetch(`/api/cases/${caseId}/documents`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          })
          
          if (!uploadRes.ok) {
            const error = await uploadRes.json()
            console.error(`Failed to upload ${file.name}:`, error.error)
            toast.error(`Failed to upload ${file.name}`)
          }
        }
        
        setUploading(false)
      }
      
      toast.success('Case created successfully!')
      router.push(`/cases/${caseId}`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create case')
      setUploading(false)
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { num: 1, label: 'Case Details' },
    { num: 2, label: 'Clients & Opponents' },
    { num: 3, label: 'Documents' },
    { num: 4, label: 'Review' }
  ]

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-3xl font-bold mb-8">Add New Case</h1>

      {/* --- UI BELOW UNCHANGED --- */}
      {/* I’m keeping the rest of your JSX exactly as-is to avoid breaking layout */}

      {/* STEPS HEADER */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center flex-1">
            <div className={`flex items-center gap-3 ${step >= s.num ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= s.num ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                {step > s.num ? <Check className="w-5 h-5" /> : s.num}
              </div>
              <span className="hidden sm:block font-medium">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-4 ${step > s.num ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      {/* STEP 1: CASE DETAILS */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Case Details</CardTitle>
            <CardDescription>Enter the basic information about the case.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Case Title <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. State vs. John Doe"
                value={caseData.case_title}
                onChange={(e) => setCaseData({ ...caseData, case_title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Case Type</Label>
                <Select
                  value={caseData.case_type}
                  onValueChange={(val) => setCaseData({ ...caseData, case_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CASE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Court Name</Label>
                <Input
                  placeholder="e.g. High Court of Delhi"
                  value={caseData.court_name}
                  onChange={(e) => setCaseData({ ...caseData, court_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Court City</Label>
                <Input
                  placeholder="City"
                  value={caseData.court_city}
                  onChange={(e) => setCaseData({ ...caseData, court_city: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Court State</Label>
                <Input
                  placeholder="State"
                  value={caseData.court_state}
                  onChange={(e) => setCaseData({ ...caseData, court_state: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Filing Date</Label>
                <Input
                  type="date"
                  value={caseData.filing_date}
                  onChange={(e) => setCaseData({ ...caseData, filing_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Next Hearing Date</Label>
                <Input
                  type="date"
                  value={caseData.next_hearing_date}
                  onChange={(e) => setCaseData({ ...caseData, next_hearing_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Agreed Fee (₹)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={caseData.agreed_fee}
                  onChange={(e) => setCaseData({ ...caseData, agreed_fee: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={caseData.priority}
                  onValueChange={(val) => setCaseData({ ...caseData, priority: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Routine">Routine</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={() => setStep(2)}>
                Next: Parties <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: PARTIES */}
      {step === 2 && (
        <div className="space-y-6">
          {/* CLIENTS */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Clients</CardTitle>
                <CardDescription>Add one or more clients associated with this case.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={addClient}>
                <Plus className="w-4 h-4 mr-2" /> Add Client
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {clients.map((client, i) => (
                <div key={i} className="relative p-4 border rounded-lg bg-muted/40 space-y-3">
                  {clients.length > 1 && (
                    <button
                      onClick={() => removeClient(i)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Full Name <span className="text-red-500">*</span></Label>
                      <Input
                        value={client.name}
                        onChange={(e) => updateClient(i, 'name', e.target.value)}
                        placeholder="Client Name"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Phone</Label>
                      <Input
                        value={client.phone}
                        onChange={(e) => updateClient(i, 'phone', e.target.value)}
                        placeholder="Contact Number"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label>Address</Label>
                      <Input
                        value={client.address}
                        onChange={(e) => updateClient(i, 'address', e.target.value)}
                        placeholder="Address"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Role</Label>
                      <Select
                        value={client.role_label}
                        onValueChange={(val) => updateClient(i, 'role_label', val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Role" />
                        </SelectTrigger>
                        <SelectContent>
                          {PARTY_ROLES.map((r) => (
                            <SelectItem key={r} value={r!}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* OPPONENTS */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Opponents</CardTitle>
                <CardDescription>Add one or more opponents.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={addOpponent}>
                <Plus className="w-4 h-4 mr-2" /> Add Opponent
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {opponents.map((opponent, i) => (
                <div key={i} className="relative p-4 border rounded-lg bg-muted/40 space-y-3">
                  {opponents.length > 1 && (
                    <button
                      onClick={() => removeOpponent(i)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Full Name</Label>
                      <Input
                        value={opponent.name}
                        onChange={(e) => updateOpponent(i, 'name', e.target.value)}
                        placeholder="Opponent Name"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Role</Label>
                      <Select
                        value={opponent.role_label}
                        onValueChange={(val) => updateOpponent(i, 'role_label', val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Role" />
                        </SelectTrigger>
                        <SelectContent>
                          {PARTY_ROLES.map((r) => (
                            <SelectItem key={r} value={r!}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)}>
              Next: Documents <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: DOCUMENTS */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
            <CardDescription>Attach relevant documents like FIR, contracts, notices, or other case files.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Documents (Optional)</Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 text-center hover:border-muted-foreground/50 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => setDocuments(Array.from(e.target.files || []))}
                  className="hidden"
                  id="document-upload"
                />
                <label htmlFor="document-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground mb-2">
                    Click to upload documents
                  </p>
                  <p className="text-sm text-muted-foreground">
                    PDF, DOC, DOCX, JPG, PNG up to 10MB each
                  </p>
                </label>
              </div>
            </div>

            {documents.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Documents ({documents.length})</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {documents.map((file, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDocuments(documents.filter((_, i) => i !== index))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)}>
                Next: Review <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: REVIEW */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Creating</CardTitle>
            <CardDescription>Please review all details before creating the case.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-lg border-b pb-1">Case Info</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Title:</span> {caseData.case_title}</div>
                <div><span className="text-muted-foreground">Type:</span> {caseData.case_type || '-'}</div>
                <div><span className="text-muted-foreground">Court:</span> {caseData.court_name || '-'}</div>
                <div><span className="text-muted-foreground">Next Hearing:</span> {caseData.next_hearing_date || '-'}</div>
                <div><span className="text-muted-foreground">Agreed Fee:</span> ₹{caseData.agreed_fee || '0'}</div>
                <div><span className="text-muted-foreground">Priority:</span> {caseData.priority}</div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-lg border-b pb-1">Clients ({clients.length})</h3>
              {clients.map((c, i) => (
                <div key={i} className="text-sm">
                  {i + 1}. {c.name} ({c.role_label}) - {c.phone || 'No phone'}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-lg border-b pb-1">Opponents ({opponents.length})</h3>
              {opponents.map((o, i) => (
                <div key={i} className="text-sm">
                  {i + 1}. {o.name} ({o.role_label})
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-lg border-b pb-1">Documents ({documents.length})</h3>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents attached</p>
              ) : (
                documents.map((doc, i) => (
                  <div key={i} className="text-sm">
                    {i + 1}. {doc.name} ({(doc.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={handleSubmit} disabled={loading || uploading}>
                {loading || uploading ? (uploading ? 'Uploading...' : 'Creating...') : 'Create Case'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
