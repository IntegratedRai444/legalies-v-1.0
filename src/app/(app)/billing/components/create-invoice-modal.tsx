'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

export function CreateInvoiceModal({ onInvoiceCreated }: { onInvoiceCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cases, setCases] = useState<any[]>([])
  const [selectedCase, setSelectedCase] = useState<string>('')
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('')
  
  const [items, setItems] = useState([{ description: '', quantity: 1, unit_price: 0 }])
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      fetch('/api/cases', {
        credentials: 'include'
      })
        .then(res => res.json())
        .then(data => setCases(Array.isArray(data.data) ? data.data : []))
    }
  }, [open])

  useEffect(() => {
    if (selectedCase) {
      const caseObj = cases.find(c => c.id === selectedCase)
      if (caseObj && caseObj.clients) {
        setClients(caseObj.clients.map((c: any) => c.party))
        if (caseObj.clients.length > 0) {
          setSelectedClient(caseObj.clients[0].party.id)
        }
      }
    }
  }, [selectedCase, cases])

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0 }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCase || !selectedClient || items.length === 0 || !items[0].description) {
      toast.error("Please fill in all required fields")
      return
    }

    setLoading(true)
    try {
      const totalAmount = calculateTotal()
      const invoiceData = {
        case_id: selectedCase,
        client_id: selectedClient,
        issue_date: issueDate,
        due_date: dueDate || null,
        total_amount: totalAmount,
        status: 'Unpaid',
        notes,
        items: items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.quantity * item.unit_price
        }))
      }

      const res = await fetch('/api/billing', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      })

      if (!res.ok) throw new Error('Failed to create invoice')

      toast.success("Invoice created successfully")
      setOpen(false)
      onInvoiceCreated()
      // Reset form
      setSelectedCase('')
      setSelectedClient('')
      setItems([{ description: '', quantity: 1, unit_price: 0 }])
      setNotes('')
    } catch (error) {
      console.error(error)
      toast.error("Failed to create invoice")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="legal-gradient">
          <Plus className="w-4 h-4 mr-2" />
          Create Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
          <DialogDescription>
            Generate a new invoice for a case. Select the client and add billable items.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="case">Case</Label>
              <Select value={selectedCase} onValueChange={setSelectedCase}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a case" />
                </SelectTrigger>
                <SelectContent>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.case_title} ({c.case_uid})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient} disabled={!selectedCase}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue Date</Label>
              <Input 
                id="issueDate" 
                type="date" 
                value={issueDate} 
                onChange={(e) => setIssueDate(e.target.value)} 
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date (Optional)</Label>
              <Input 
                id="dueDate" 
                type="date" 
                value={dueDate} 
                onChange={(e) => setDueDate(e.target.value)} 
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Billable Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
            
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <Input 
                      placeholder="Description" 
                      value={item.description} 
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      required
                    />
                  </div>
                  <div className="w-20">
                    <Input 
                      type="number" 
                      placeholder="Qty" 
                      value={item.quantity} 
                      onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                      min="1"
                      required
                    />
                  </div>
                  <div className="w-32">
                    <Input 
                      type="number" 
                      placeholder="Price" 
                      value={item.unit_price} 
                      onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea 
              id="notes" 
              placeholder="Internal notes or instructions..." 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-lg font-bold">
                Total: ₹{calculateTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="legal-gradient" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Generate Invoice
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
