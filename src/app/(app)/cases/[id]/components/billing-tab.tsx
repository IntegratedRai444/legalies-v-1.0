'use client'

import { useState, useEffect } from 'react'
import { Receipt, IndianRupee, TrendingUp, Wallet, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { CaseWithParties } from '@/lib/types'

interface BillingTabProps {
  caseData: CaseWithParties
  onUpdate: () => void
}

import { createClient } from '@/lib/supabase/client'

export function BillingTab({ caseData, onUpdate }: BillingTabProps) {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editFeeOpen, setEditFeeOpen] = useState(false)
  const [newFee, setNewFee] = useState(caseData.agreed_fee?.toString() || '0')
  const [saving, setSaving] = useState(false)
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

  const fetchData = async () => {
    try {
      const [expRes, payRes] = await Promise.all([
        fetch(`/api/expenses?case_id=${caseData.id}`),
        fetch(`/api/billing?case_id=${caseData.id}`)
      ])

      const expData = await expRes.json()
      const payData = await payRes.json()
      
      setExpenses(Array.isArray(expData) ? expData : [])
      setPayments(Array.isArray(payData) ? payData : [])
    } catch (error) {
      console.error('Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [caseData.id])

  if (role === 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-12 border rounded-xl bg-muted/20 space-y-4">
        <Receipt className="w-12 h-12 text-muted-foreground opacity-20" />
        <div className="text-center">
          <h3 className="font-bold text-lg">Financial Information Restricted</h3>
          <p className="text-muted-foreground max-w-sm">
            Administrative accounts are restricted from viewing financial details to focus on firm operations.
          </p>
        </div>
      </div>
    )
  }

  const handleUpdateFee = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/cases/${caseData.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreed_fee: parseFloat(newFee) })
      })

      if (!res.ok) throw new Error()
      toast.success('Agreed fee updated')
      setEditFeeOpen(false)
      onUpdate()
    } catch (error) {
      toast.error('Failed to update fee')
    } finally {
      setSaving(false)
    }
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
  const totalPayments = payments
    .filter(p => p.status === 'Paid')
    .reduce((sum, p) => sum + Number(p.total_amount), 0)

  const netValue = (caseData.agreed_fee || 0) - totalExpenses

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Billing Summary</h2>
          <p className="text-sm text-muted-foreground">Internal financial overview for this case</p>
        </div>

        <Dialog open={editFeeOpen} onOpenChange={setEditFeeOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Pencil className="w-4 h-4 mr-2" />
              Set Agreed Fee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Agreed Fee</DialogTitle>
              <DialogDescription>Set the total fee agreed upon for this case.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="fee">Agreed Fee (₹)</Label>
                <Input 
                  id="fee" 
                  type="number" 
                  value={newFee}
                  onChange={(e) => setNewFee(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={() => setEditFeeOpen(false)}>Cancel</Button>
              <Button className="legal-gradient" onClick={handleUpdateFee} disabled={saving}>
                {saving ? 'Updating...' : 'Update Fee'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <IndianRupee className="w-4 h-4" />
              Agreed Fee
            </CardDescription>
            <CardTitle className="text-2xl">₹{(caseData.agreed_fee || 0).toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Payments
            </CardDescription>
            <CardTitle className="text-2xl">₹{totalPayments.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Total Expenses
            </CardDescription>
            <CardTitle className="text-2xl">₹{totalExpenses.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>

        <Card className={`border-l-4 ${netValue >= 0 ? 'border-l-primary' : 'border-l-destructive'}`}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Net Case Value
            </CardDescription>
            <CardTitle className={`text-2xl ${netValue < 0 ? 'text-destructive' : 'text-primary'}`}>
              ₹{netValue.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financial Notes</CardTitle>
          <CardDescription>
            The Net Case Value is calculated as (Agreed Fee - Total Expenses). 
            This represents the firm's gross margin on the case before internal resource costs.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
