'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Briefcase, 
  Users, 
  Calendar, 
  AlertCircle,
  Clock,
  Activity,
  User as UserIcon,
  CheckSquare
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface AdminStats {
  stats: {
    activeCases: number
    totalCases: number
    urgentCases: number
    inactiveCases: number
    totalAdvocates: number
    overdueTasks: number
    casesByStatus: {
      Active: number
      Closed: number
      Pending: number
    }
  }
  staleCases: Array<{
    id: string
    case_title: string
    assigned_advocate: string
    last_activity_date: string
  }>
  alerts: Array<{
    id: string
    case_title: string
    type: string
  }>
  workload: Array<{ 
    name: string; 
    caseCount: number; 
    pendingTasks: number;
    overdueTasks: number;
    hearingsThisWeek: number;
  }>
  upcomingHearings: Array<{
    id: string
    case_title: string
    next_hearing_date: string
    court_name: string
    assigned_lawyer?: { full_name: string }
  }>
  recentActivity: Array<{
    id: string
    activity_type: string
    description: string
    created_at: string
    user?: { full_name: string }
    case?: { case_title: string }
  }>
}

export default function AdminDashboard() {
    const [data, setData] = useState<AdminStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
  
    useEffect(() => {
      fetchStats()
    }, [])
  
    const fetchStats = async () => {
      setError(null)
      try {
        const res = await fetch('/api/admin/stats')
        const json = await res.json()
        if (json.error) {
          setError(json.error)
          toast.error(json.error)
        } else {
          setData(json)
        }
      } catch (err) {
        setError('Failed to connect to server')
        toast.error('Failed to load admin dashboard')
      } finally {
        setLoading(false)
      }
    }
  
    if (loading) return <div className="p-8 animate-pulse space-y-6">
      <div className="h-10 bg-muted rounded w-64" />
      <div className="grid gap-4 md:grid-cols-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-64 bg-muted rounded-xl" />
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    </div>

    if (error) {
      return (
        <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-xl font-semibold">Access Denied or Error</h2>
          <p className="text-muted-foreground">{error === 'Forbidden' ? 'You do not have administrative privileges to view this page.' : error}</p>
          <Button onClick={fetchStats} variant="outline">Try Again</Button>
        </div>
      )
    }
  
    if (!data) return null

  return (
    <div className="p-6 lg:p-8 space-y-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Firm-wide workload management and scheduling oversight</p>
          </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link href="/dashboard">
                <Button variant="outline" className="border-accent/20 text-accent hover:bg-accent/5">
                  <UserIcon className="w-4 h-4 mr-2" />
                  My Work
                </Button>
              </Link>
              <Link href="/admin/reassignment">

              <Button variant="outline" className="border-primary/20 text-primary hover:bg-primary/5">
                <Briefcase className="w-4 h-4 mr-2" />
                Bulk Reassign
              </Button>
            </Link>
            <Link href="/admin/users">
              <Button className="legal-gradient">
                <Users className="w-4 h-4 mr-2" />
                Manage Users
              </Button>
            </Link>
          </div>

        </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Cases</p>
              <p className="text-3xl font-bold mt-1">{data.stats.activeCases}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl">
              <Briefcase className="w-6 h-6 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-accent shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Advocates</p>
              <p className="text-3xl font-bold mt-1">{data.stats.totalAdvocates}</p>
            </div>
            <div className="p-3 bg-accent/10 rounded-xl">
              <Users className="w-6 h-6 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Overdue Tasks</p>
              <p className="text-3xl font-bold mt-1">{data.stats.overdueTasks}</p>
            </div>
            <div className="p-3 bg-destructive/10 rounded-xl">
              <CheckSquare className="w-6 h-6 text-destructive" />
            </div>
          </CardContent>
        </Card>

          <Card className="border-l-4 border-l-chart-2 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stale Cases</p>
                <p className="text-3xl font-bold mt-1">{data.stats.inactiveCases}</p>
              </div>
              <div className="p-3 bg-chart-2/10 rounded-xl">
                <Clock className="w-6 h-6 text-chart-2" />
              </div>
            </CardContent>
          </Card>
        </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Step 2: Operational Alerts */}
        <Card className="lg:col-span-1 border-destructive/20 shadow-sm">
          <CardHeader className="bg-destructive/5 rounded-t-xl">
            <CardTitle className="flex items-center gap-2 text-lg text-destructive">
              <AlertCircle className="w-5 h-5" />
              Operational Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {data.alerts.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No alerts found</p>
            ) : (
              data.alerts.slice(0, 10).map((alert, i) => (
                <Link key={i} href={`/cases/${alert.id}`} className="block">
                  <div className="p-3 rounded-lg border bg-destructive/5 hover:bg-destructive/10 transition-colors border-destructive/10">
                    <p className="font-semibold text-sm line-clamp-1">{alert.case_title}</p>
                    <p className="text-xs text-destructive font-medium mt-1">{alert.type}</p>
                  </div>
                </Link>
              ))
            )}
            {data.alerts.length > 10 && (
              <p className="text-xs text-center text-muted-foreground italic">And {data.alerts.length - 10} more alerts...</p>
            )}
          </CardContent>
        </Card>

        {/* Step 4: Advocate Workload Table */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserIcon className="w-5 h-5 text-primary" />
              Advocate Workload Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Advocate</th>
                    <th className="px-4 py-3 text-center">Active Cases</th>
                    <th className="px-4 py-3 text-center">Hearings (7d)</th>
                    <th className="px-4 py-3 text-center">Pending</th>
                    <th className="px-4 py-3 text-center text-destructive">Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.workload.map((adv, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-semibold">{adv.name}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary">{adv.caseCount}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">{adv.hearingsThisWeek}</td>
                      <td className="px-4 py-3 text-center font-medium">{adv.pendingTasks}</td>
                      <td className="px-4 py-3 text-center font-bold text-destructive">
                        {adv.overdueTasks > 0 ? adv.overdueTasks : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Step 1: Stale Case Monitor */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-chart-2" />
            Inactive / Stale Cases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.staleCases.length === 0 ? (
              <div className="col-span-full py-12 text-center border rounded-xl border-dashed">
                <Activity className="w-12 h-12 text-muted-foreground mx-auto opacity-20" />
                <p className="text-muted-foreground mt-2">All cases are currently active and updated.</p>
              </div>
            ) : (
              data.staleCases.slice(0, 6).map((c) => (
                <Link key={c.id} href={`/cases/${c.id}`} className="group">
                  <div className="p-4 rounded-xl border bg-muted/5 group-hover:bg-muted/10 transition-all border-chart-2/20 hover:border-chart-2">
                    <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors">{c.case_title}</h3>
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Assigned to:</span>
                        <span className="font-medium text-foreground">{c.assigned_advocate}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Last Activity:</span>
                        <span className="font-medium text-foreground">
                          {c.last_activity_date ? format(parseISO(c.last_activity_date), 'MMM d, yyyy') : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
          {data.staleCases.length > 6 && (
            <div className="mt-4 text-center">
               <Link href="/cases?filter=stale">
                  <Button variant="link" className="text-xs">View all {data.staleCases.length} stale cases</Button>
               </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Step 5: Recent Firm Activity */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="w-5 h-5 text-primary" />
              Recent Firm Activity (Operational)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {data.recentActivity.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No recent activity</p>
            ) : (
              data.recentActivity.map((activity) => (
                <div key={activity.id} className="flex gap-4 p-3 rounded-lg border bg-muted/30 hover:border-primary/20 transition-colors">
                  <div className="mt-1">
                    <Activity className="w-4 h-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm leading-relaxed">
                      <span className="font-semibold">{activity.user?.full_name}</span>
                      {' '}{activity.description}
                      {activity.case && (
                        <span className="text-primary font-medium italic"> &quot;{activity.case.case_title}&quot;</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(parseISO(activity.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Upcoming Hearings */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-primary" />
              Upcoming Firm Hearings (Next 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative overflow-x-auto border rounded-xl">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Case</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Court</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.upcomingHearings.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No hearings scheduled</td>
                    </tr>
                  ) : (
                    data.upcomingHearings.map((hearing) => (
                      <tr key={hearing.id} className="hover:bg-muted/50 transition-colors text-xs">
                        <td className="px-4 py-3">
                          <p className="font-medium line-clamp-1">{hearing.case_title}</p>
                          <p className="text-[10px] text-primary">{hearing.assigned_lawyer?.full_name}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {format(parseISO(hearing.next_hearing_date), 'MMM d')}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground line-clamp-1">{hearing.court_name}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    )
}
