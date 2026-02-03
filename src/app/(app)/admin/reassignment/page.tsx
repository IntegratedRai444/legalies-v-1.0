'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Users, Briefcase, Filter, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function BulkReassignmentPage() {
  const router = useRouter()
  const [cases, setCases] = useState<any[]>([])
  const [advocates, setAdvocates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCases, setSelectedCases] = useState<string[]>([])
  const [filterAdvocate, setFilterAdvocate] = useState<string>('all')
  const [newAdvocate, setNewAdvocate] = useState<string>('')
  const [newPriority, setNewPriority] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [casesRes, advocatesRes] = await Promise.all([
        fetch('/api/cases'),
        fetch('/api/admin/users?role=advocate')
      ])
      
      const casesData = await casesRes.json()
      const advocatesData = await advocatesRes.json()
      
      setCases(casesData || [])
      setAdvocates(advocatesData || [])
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const filteredCases = cases.filter(c => 
    filterAdvocate === 'all' || c.assigned_lawyer_id === filterAdvocate
  )

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCases(filteredCases.map(c => c.id))
    } else {
      setSelectedCases([])
    }
  }

  const handleSelectCase = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedCases([...selectedCases, id])
    } else {
      setSelectedCases(selectedCases.filter(i => i !== id))
    }
  }

  const handleBulkUpdate = async () => {
    if (selectedCases.length === 0) {
      toast.error('Please select at least one case')
      return
    }
    if (!newAdvocate && !newPriority) {
      toast.error('Please select a new advocate or priority')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseIds: selectedCases,
          newLawyerId: newAdvocate || undefined,
          priority: newPriority || undefined
        })
      })

      if (!res.ok) throw new Error()
      
      toast.success(`Successfully updated ${selectedCases.length} cases`)
      setSelectedCases([])
      setNewAdvocate('')
      setNewPriority('')
      fetchData()
    } catch {
      toast.error('Failed to update cases')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold">Bulk Case Reassignment</h1>
          <p className="text-muted-foreground">Reassign multiple cases or update priority levels in bulk</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter Cases
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Assigned Advocate</Label>
              <Select value={filterAdvocate} onValueChange={setFilterAdvocate}>
                <SelectTrigger>
                  <SelectValue placeholder="All Advocates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Advocates</SelectItem>
                  {advocates.map(adv => (
                    <SelectItem key={adv.id} value={adv.id}>{adv.full_name}</SelectItem>
                  ))}
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="pt-4 border-t mt-4">
              <p className="text-xs text-muted-foreground">Showing {filteredCases.length} cases</p>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardContent className="p-4 border-b bg-muted/30">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="select-all" 
                    checked={selectedCases.length === filteredCases.length && filteredCases.length > 0}
                    onCheckedChange={(v) => handleSelectAll(!!v)}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                    Select All ({selectedCases.length} selected)
                  </label>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={newAdvocate} onValueChange={setNewAdvocate}>
                    <SelectTrigger className="w-48 bg-background">
                      <SelectValue placeholder="Move to Advocate" />
                    </SelectTrigger>
                    <SelectContent>
                      {advocates.map(adv => (
                        <SelectItem key={adv.id} value={adv.id}>{adv.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger className="w-40 bg-background">
                      <SelectValue placeholder="Set Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Routine">Routine</SelectItem>
                      <SelectItem value="High Attention">High Attention</SelectItem>
                      <SelectItem value="Urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button 
                    className="legal-gradient" 
                    disabled={selectedCases.length === 0 || submitting}
                    onClick={handleBulkUpdate}
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Apply Changes
                  </Button>
                </div>
              </div>
            </CardContent>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 w-10"></th>
                      <th className="px-4 py-3 font-medium">Case Title</th>
                      <th className="px-4 py-3 font-medium">Current Advocate</th>
                      <th className="px-4 py-3 font-medium text-center">Priority</th>
                      <th className="px-4 py-3 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCases.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <Checkbox 
                            checked={selectedCases.includes(c.id)}
                            onCheckedChange={(v) => handleSelectCase(c.id, !!v)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{c.case_title}</p>
                          <p className="text-xs text-primary font-mono">{c.case_uid}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.assigned_lawyer?.full_name || 'Unassigned'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {c.priority && (
                            <Badge variant={c.priority === 'Urgent' ? 'destructive' : c.priority === 'High Attention' ? 'default' : 'outline'}>
                              {c.priority}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="secondary">{c.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>{children}</label>
}
