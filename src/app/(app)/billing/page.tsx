'use client'

import { useEffect, useState } from 'react'
import { ReceiptText, TrendingUp, AlertCircle, CheckCircle2, Clock, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InvoiceList } from "./components/invoice-list"
import { CreateInvoiceModal } from "./components/create-invoice-modal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from '@/lib/supabase/client'

export default function BillingPage() {
  const supabase = createClient()
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [activeTab, setActiveTab] = useState('all')
  const [firmId, setFirmId] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    paidToday: 0,
    totalInvoices: 0
  })

  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1)

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('firm_id').eq('id', user.id).single()
        setFirmId(data?.firm_id || null)
      }
    }
    fetchUser()
  }, [supabase])

      useEffect(() => {
        async function fetchStats() {
          try {
            const res = await fetch('/api/billing')
            const { data, error } = await res.json()
            if (Array.isArray(data)) {
              const invoices = data
              const today = new Date().toISOString().split('T')[0]
              const newStats = invoices.reduce((acc, inv) => {
              acc.totalInvoices += 1
              
              // Calculate financial stats for all firm users
              if (inv.status === 'Paid') {
                acc.totalRevenue += Number(inv.total_amount || 0)
                if (inv.updated_at && inv.updated_at.startsWith(today)) {
                  acc.paidToday += Number(inv.total_amount || 0)
                }
              }

              if (inv.status === 'Unpaid') {
                acc.pendingInvoices += 1
                if (inv.due_date && new Date(inv.due_date) < new Date()) {
                  acc.overdueInvoices += 1
                }
              } else if (inv.status === 'Overdue') {
                acc.pendingInvoices += 1
                acc.overdueInvoices += 1
              }
              return acc
            }, { totalRevenue: 0, pendingInvoices: 0, overdueInvoices: 0, paidToday: 0, totalInvoices: 0 })
            setStats(newStats)
          }
        } catch (error) {
          console.error('Failed to fetch stats:', error)
        }
      }
      if (firmId) fetchStats()
    }, [refreshTrigger, firmId])


  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing System</h1>
          <p className="text-muted-foreground">
            Manage invoices, payments, and financial records for your cases.
          </p>
        </div>
        {firmId && <CreateInvoiceModal onInvoiceCreated={triggerRefresh} />}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {firmId && (
          <Card className="bg-card/50 backdrop-blur border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{stats.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  All time collected
                </p>
              </CardContent>
          </Card>
        )}

        <Card className="bg-card/50 backdrop-blur border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingInvoices}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting payment
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-l-4 border-l-rose-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overdueInvoices}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires attention
            </p>
          </CardContent>
        </Card>
        
        {firmId && (
          <Card className="bg-card/50 backdrop-blur border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid Today</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.paidToday.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Successfully processed
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="all">All Invoices</TabsTrigger>
              <TabsTrigger value="Unpaid">Unpaid</TabsTrigger>
              <TabsTrigger value="Paid">Paid</TabsTrigger>
              <TabsTrigger value="Overdue">Overdue</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="all" className="mt-4">
            <InvoiceList refreshTrigger={refreshTrigger} status="all" />
          </TabsContent>
          <TabsContent value="Unpaid" className="mt-4">
            <InvoiceList refreshTrigger={refreshTrigger} status="Unpaid" />
          </TabsContent>
          <TabsContent value="Paid" className="mt-4">
            <InvoiceList refreshTrigger={refreshTrigger} status="Paid" />
          </TabsContent>
          <TabsContent value="Overdue" className="mt-4">
            <InvoiceList refreshTrigger={refreshTrigger} status="Overdue" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
