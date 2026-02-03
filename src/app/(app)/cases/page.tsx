'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Plus, Calendar, Building, Users, AlertCircle } from 'lucide-react'
import { CaseWithParties, CASE_STATUSES } from '@/lib/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function CasesContent() {
  const searchParams = useSearchParams()
  const [cases, setCases] = useState<CaseWithParties[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState(searchParams.get('status') || 'all')

  const fetchCases = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (status && status !== 'all') params.set('status', status)

      const res = await fetch(`/api/cases?${params}`)
      const { data, error } = await res.json()
      if (error || !Array.isArray(data)) {
        setCases([])
      } else {
        setCases(data)
      }
    } catch {
      toast.error('Failed to load cases')
      setCases([])
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    const timer = setTimeout(fetchCases, 300)
    return () => clearTimeout(timer)
  }, [fetchCases])

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 border-green-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    disposed: 'bg-gray-100 text-gray-800 border-gray-200',
    stay: 'bg-blue-100 text-blue-800 border-blue-200',
    withdrawn: 'bg-purple-100 text-purple-800 border-purple-200',
    transferred: 'bg-orange-100 text-orange-800 border-orange-200'
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Cases Register</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            {cases.length} case{cases.length !== 1 ? 's' : ''} under management
          </p>
        </div>
        <Link href="/cases/new">
          <Button className="legal-gradient h-12 px-6 shadow-md">
            <Plus className="w-5 h-5 mr-2" />
            Add New Case
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-muted/30 p-4 rounded-3xl border border-muted/50">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
          <Input
            placeholder="Search by client, opponent, case UID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 h-12 text-base bg-background border-none shadow-sm focus-visible:ring-1"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-56 h-12 bg-background border-none shadow-sm">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {CASE_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-32 bg-muted/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-muted/10 rounded-[2rem] border-2 border-dashed">
          <AlertCircle className="w-12 h-12 text-muted-foreground/20 mb-4" />
          <h3 className="text-xl font-bold text-muted-foreground">No cases found</h3>
          <p className="text-muted-foreground mt-2 mb-8">Try adjusting your search or filters.</p>
          <Link href="/cases/new">
            <Button variant="outline" className="rounded-xl h-11 px-6">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Case
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {cases.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`}>
              <Card className="border-none shadow-sm hover:shadow-md transition-all cursor-pointer group rounded-[1.25rem] bg-card overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row lg:items-center p-5 lg:p-6 gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-baseline gap-3 mb-4">
                        <h2 className="font-bold text-lg lg:text-xl truncate group-hover:text-primary transition-colors leading-tight">{c.case_title}</h2>
                        <span className="text-xs font-mono text-muted-foreground/70 shrink-0">#{c.case_uid}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-2 gap-x-6 text-[13px]">
                        {c.clients?.length > 0 && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                            <span className="truncate">
                              {c.clients.map(cl => cl.party?.name).join(', ')}
                            </span>
                          </div>
                        )}
                        {c.court_name && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                            <span className="truncate">{c.court_name}</span>
                          </div>
                        )}
                        {c.next_hearing_date && (
                          <div className="flex items-center gap-2 text-destructive/70 font-medium">
                            <Calendar className="w-4 h-4 shrink-0" />
                            <span>Hearing: {format(parseISO(c.next_hearing_date), 'MMM d')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0">
                      {c.priority && (
                        <Badge variant={c.priority === 'Urgent' ? 'destructive' : c.priority === 'High Attention' ? 'default' : 'outline'} className="capitalize px-3 py-0.5">
                          {c.priority}
                        </Badge>
                      )}
                      <Badge variant="outline" className={cn(statusColors[c.status?.toLowerCase()] || 'bg-gray-100', "px-3 py-0.5 border")}>{c.status}</Badge>
                      <Badge variant="secondary" className="px-3 py-0.5">{c.stage}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CasesPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading cases...</div>}>
      <CasesContent />
    </Suspense>
  )
}
