'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { Plus, Trash2, Receipt, Filter, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { CaseExpense } from '@/lib/types'

interface ExpensesTabProps {
  caseId: string
}

import { createClient } from '@/lib/supabase/client'

export function ExpensesTab({ caseId }: ExpensesTabProps) {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<CaseExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const [editingExpense, setEditingExpense] = useState<CaseExpense | null>(null)
  const [newExpense, setNewExpense] = useState({
    title: '',
    category: 'misc',
    amount: '',
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    description: ''
  })

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

  const fetchExpenses = async () => {
    try {
      const res = await fetch(`/api/expenses?case_id=${caseId}`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to fetch expenses')
      const data = await res.json()
      setExpenses(data)
    } catch (error) {
      toast.error('Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpenses()
  }, [caseId])

  const handleAddExpense = async () => {
    if (!newExpense.title || !newExpense.amount || !newExpense.expense_date) {
      toast.error('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          ...newExpense,
          amount: parseFloat(newExpense.amount)
        })
      })

      if (!res.ok) throw new Error('Failed to add expense')
      
      toast.success('Expense added successfully')
      setDialogOpen(false)
      setNewExpense({
        title: '',
        category: 'misc',
        amount: '',
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        description: ''
      })
      fetchExpenses()
    } catch (error) {
      toast.error('Failed to add expense')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return

    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!res.ok) throw new Error('Failed to delete expense')
      
      toast.success('Expense deleted')
      fetchExpenses()
    } catch (error) {
      toast.error('Failed to delete expense')
    }
  }

  const handleEditExpense = (expense: CaseExpense) => {
    setEditingExpense(expense)
    setNewExpense({
      title: expense.title,
      category: expense.category || 'misc',
      amount: expense.amount.toString(),
      expense_date: expense.expense_date,
      description: expense.description || ''
    })
    setEditDialogOpen(true)
  }

  const handleUpdateExpense = async () => {
    if (!editingExpense || !newExpense.title || !newExpense.amount || !newExpense.expense_date) {
      toast.error('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newExpense.title,
          category: newExpense.category,
          amount: parseFloat(newExpense.amount),
          expense_date: newExpense.expense_date,
          description: newExpense.description
        })
      })

      if (!res.ok) throw new Error('Failed to update expense')
      
      toast.success('Expense updated successfully')
      setEditDialogOpen(false)
      setEditingExpense(null)
      setNewExpense({
        title: '',
        category: 'misc',
        amount: '',
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        description: ''
      })
      fetchExpenses()
    } catch (error) {
      toast.error('Failed to update expense')
    } finally {
      setSaving(false)
    }
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Case Expenses</h2>
          <p className="text-sm text-muted-foreground">Internal tracking of out-of-pocket costs</p>
        </div>
        
        {role !== 'admin' && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="legal-gradient">
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Expense</DialogTitle>
                <DialogDescription>Record a new out-of-pocket expense for this case.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input 
                    id="title" 
                    placeholder="e.g., Court Filing Fee" 
                    value={newExpense.title}
                    onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (₹) *</Label>
                    <Input 
                      id="amount" 
                      type="number" 
                      placeholder="0.00" 
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input 
                      id="date" 
                      type="date" 
                      value={newExpense.expense_date}
                      onChange={(e) => setNewExpense({ ...newExpense, expense_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select 
                    value={newExpense.category} 
                    onValueChange={(v) => setNewExpense({ ...newExpense, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="court_fee">Court Fee</SelectItem>
                      <SelectItem value="travel">Travel</SelectItem>
                      <SelectItem value="printing">Printing & Stationery</SelectItem>
                      <SelectItem value="misc">Miscellaneous</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Additional details..." 
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button className="legal-gradient" onClick={handleAddExpense} disabled={saving}>
                  {saving ? 'Adding...' : 'Add Expense'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={role === 'admin' ? 'bg-muted/30' : 'bg-primary/5 border-primary/20'}>
          <CardHeader className="pb-2">
            <CardDescription className={role === 'admin' ? '' : 'text-primary/70'}>Total Expenses</CardDescription>
            <CardTitle className="text-2xl text-primary">
              {role === 'admin' ? 'Hidden' : `₹${totalExpenses.toLocaleString()}`}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Number of Entries</CardDescription>
            <CardTitle className="text-2xl">{expenses.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recent Category</CardDescription>
            <CardTitle className="text-2xl capitalize">{expenses[0]?.category?.replace('_', ' ') || 'N/A'}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                {role !== 'admin' && <TableHead>Amount</TableHead>}
                <TableHead>Added By</TableHead>
                {role !== 'admin' && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={role === 'admin' ? 4 : 6} className="text-center py-8 text-muted-foreground italic">
                    Loading expenses...
                  </TableCell>
                </TableRow>
              ) : expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={role === 'admin' ? 4 : 6} className="text-center py-8 text-muted-foreground italic">
                    No expenses recorded for this case.
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">
                      {format(parseISO(expense.expense_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{expense.title}</p>
                        {expense.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{expense.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">
                      {expense.category?.replace('_', ' ')}
                    </TableCell>
                    {role !== 'admin' && (
                      <TableCell className="font-semibold">
                        ₹{Number(expense.amount).toLocaleString()}
                      </TableCell>
                    )}
                    <TableCell className="text-sm">
                      {expense.added_by_profile?.full_name || 'System'}
                    </TableCell>
                    {role !== 'admin' && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={() => handleEditExpense(expense)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteExpense(expense.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Expense Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Update the expense details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input 
                id="edit-title" 
                placeholder="e.g., Court Filing Fee" 
                value={newExpense.title}
                onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-amount">Amount (₹) *</Label>
                <Input 
                  id="edit-amount" 
                  type="number" 
                  placeholder="0.00" 
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date *</Label>
                <Input 
                  id="edit-date" 
                  type="date" 
                  value={newExpense.expense_date}
                  onChange={(e) => setNewExpense({ ...newExpense, expense_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Select 
                value={newExpense.category} 
                onValueChange={(v) => setNewExpense({ ...newExpense, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="court_fee">Court Fee</SelectItem>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="printing">Printing & Stationery</SelectItem>
                  <SelectItem value="misc">Miscellaneous</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea 
                id="edit-description" 
                placeholder="Additional details..." 
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button className="legal-gradient" onClick={handleUpdateExpense} disabled={saving}>
              {saving ? 'Updating...' : 'Update Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 
