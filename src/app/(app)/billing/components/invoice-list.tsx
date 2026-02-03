'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { InvoiceStatusBadge } from "./invoice-status-badge"
import { Button } from "@/components/ui/button"
import { Eye, FileDown, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { InvoiceDetailsModal } from "./invoice-details-modal"
import { createClient } from '@/lib/supabase/client'

export function InvoiceList({ refreshTrigger, status }: { refreshTrigger: number, status?: string }) {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const handleViewDetails = (id: string) => {
    setSelectedInvoiceId(id)
    setDetailsOpen(true)
  }

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setRole(data?.role || null)
      }
    }
    fetchUser()
  }, [supabase])

  useEffect(() => {
    async function fetchInvoices() {
      setLoading(true)
      try {
        const url = status && status !== 'all' 
          ? `/api/billing?status=${status}` 
          : '/api/billing'
        const res = await fetch(url)
        const { data, error } = await res.json()
        if (!error && Array.isArray(data)) {
          setInvoices(data)
        }
      } catch (error) {
        console.error('Failed to fetch invoices:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchInvoices()
  }, [refreshTrigger, status])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 border rounded-xl bg-muted/20">
        <p className="text-muted-foreground">No invoices found. Create your first invoice to get started.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Case</TableHead>
            <TableHead>Issue Date</TableHead>
            <TableHead>Due Date</TableHead>
            {role !== 'admin' && <TableHead>Amount</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
              <TableCell>{invoice.client?.name || 'N/A'}</TableCell>
              <TableCell className="max-w-[200px] truncate">
                {invoice.case?.case_title || 'N/A'}
              </TableCell>
              <TableCell>{format(new Date(invoice.issue_date), 'MMM d, yyyy')}</TableCell>
              <TableCell>
                {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : 'N/A'}
              </TableCell>
              {role !== 'admin' && (
                <TableCell className="font-semibold">
                  ₹{Number(invoice.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </TableCell>
              )}
              <TableCell>
                <InvoiceStatusBadge status={invoice.status} />
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleViewDetails(invoice.id)}>
                      <Eye className="mr-2 h-4 w-4" /> View Details
                    </DropdownMenuItem>
                    {role !== 'admin' && (
                      <DropdownMenuItem>
                        <FileDown className="mr-2 h-4 w-4" /> Download PDF
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <InvoiceDetailsModal 
        invoiceId={selectedInvoiceId} 
        open={detailsOpen} 
        onOpenChange={setDetailsOpen} 
      />
    </div>
  )
}
