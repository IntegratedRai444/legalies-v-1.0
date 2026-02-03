'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog"
import { InvoiceStatusBadge } from "./invoice-status-badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { FileDown, Printer } from "lucide-react"

import { createClient } from '@/lib/supabase/client'

export function InvoiceDetailsModal({ 
  invoiceId, 
  open, 
  onOpenChange 
}: { 
  invoiceId: string | null, 
  open: boolean, 
  onOpenChange: (open: boolean) => void 
}) {
  const supabase = createClient()
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [role, setRole] = useState<string | null>(null)

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
    if (invoiceId && open) {
      setLoading(true)
      fetch(`/api/billing`)
        .then(res => res.json())
        .then(data => {
          const inv = data.find((i: any) => i.id === invoiceId)
          if (inv) {
            setInvoice(inv)
            fetch(`/api/billing/${invoiceId}/items`)
              .then(res => res.ok ? res.json() : [])
              .then(itemsData => setItems(itemsData))
              .catch(() => setItems([]))
          }
        })
        .finally(() => setLoading(false))
    }
  }, [invoiceId, open])

  if (!invoice) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl font-bold">{invoice.invoice_number}</DialogTitle>
              <DialogDescription>
                Issued on {format(new Date(invoice.issue_date), 'MMMM d, yyyy')}
              </DialogDescription>
            </div>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
        </DialogHeader>

        <div className="space-y-8 py-4">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Bill To</h4>
              <p className="font-bold text-lg">{invoice.client?.name}</p>
              <p className="text-sm text-muted-foreground">{invoice.client?.address || 'No address provided'}</p>
              <p className="text-sm text-muted-foreground">{invoice.client?.phone}</p>
            </div>
            <div className="space-y-1 text-right">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Case Reference</h4>
              <p className="font-bold">{invoice.case?.case_title}</p>
              <p className="text-sm text-muted-foreground">{invoice.case?.case_uid}</p>
              <div className="mt-2 pt-2 border-t">
                <p className="text-sm"><span className="text-muted-foreground">Due Date:</span> {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : 'On Receipt'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  {role !== 'admin' && (
                    <>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </>
                  )}
                  {role === 'admin' && <TableHead className="text-right">Status</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length > 0 ? (
                  items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        {role !== 'admin' && (
                          <>
                            <TableCell className="text-right">₹{Number(item.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right font-semibold">₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                          </>
                        )}
                        {role === 'admin' && <TableCell className="text-right text-muted-foreground italic">Value Hidden</TableCell>}
                      </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={role === 'admin' ? 3 : 4} className="text-center py-8 text-muted-foreground">
                      {loading ? 'Loading items...' : 'No items found for this invoice.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

            {role !== 'admin' && (
              <div className="flex justify-end">
                <div className="w-64 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{Number(invoice.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax (0%)</span>
                    <span>₹0.00</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">₹{Number(invoice.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            )}

            {role === 'admin' && (
              <div className="rounded-lg bg-primary/5 p-4 border border-primary/10">
                <p className="text-sm text-center font-medium text-primary">
                  Operational View: Monetary values are hidden for administrative roles.
                </p>
              </div>
            )}

          {invoice.notes && (
            <div className="rounded-lg bg-muted/30 p-4">
              <h4 className="text-sm font-semibold mb-1">Notes</h4>
              <p className="text-sm text-muted-foreground italic">{invoice.notes}</p>
            </div>
          )}
        </div>

          <div className="flex justify-between items-center pt-4 border-t print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={role === 'admin'}>
              <Printer className="w-4 h-4 mr-2" />
              {role === 'admin' ? 'Print Restricted' : 'Print'}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={role === 'admin'}>
                <FileDown className="w-4 h-4 mr-2" />
                {role === 'admin' ? 'PDF Restricted' : 'Download PDF'}
              </Button>
            </div>
          </div>

      </DialogContent>
    </Dialog>
  )
}
