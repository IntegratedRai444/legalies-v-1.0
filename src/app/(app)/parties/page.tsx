'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, User, Phone, MapPin, ExternalLink, Plus, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface PartyWithCases {
  id: string
  name: string
  party_kind: 'client' | 'opponent' | null
  phone: string | null
  email: string | null
  address: string | null
  case_parties: Array<{
    case_id: string
    cases: {
      case_title: string
      id: string
    }
  }>
}

export default function PartiesPage() {
  const [parties, setParties] = useState<PartyWithCases[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    type: 'client',
    phone: '',
    email: '',
    address: ''
  })

  useEffect(() => {
    fetchParties()
  }, [])

  const fetchParties = async () => {
    try {
      const res = await fetch('/api/parties')
      const data = await res.json()
      if (Array.isArray(data)) {
        setParties(data)
      }
    } catch (error) {
      console.error('Error fetching parties:', error)
      toast.error("Failed to load parties")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) throw new Error('Failed to create party')

      toast.success("Party created successfully")
      setIsDialogOpen(false)
      setFormData({ name: '', type: 'client', phone: '', email: '', address: '' })
      fetchParties()
    } catch (error) {
      console.error('Error creating party:', error)
      toast.error("Failed to create party")
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredParties = parties.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone?.includes(searchQuery) ||
    p.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-10 bg-muted rounded w-48 animate-pulse" />
          <div className="h-10 bg-muted rounded w-32 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-64 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients & Opponents</h1>
          <p className="text-muted-foreground mt-1">Comprehensive directory of all firm clients and opposing parties</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Party
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateParty}>
                <DialogHeader>
                  <DialogTitle>Add New Party</DialogTitle>
                  <DialogDescription>
                    Create a new client or opponent in the firm database.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={v => setFormData({ ...formData, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Client</SelectItem>
                        <SelectItem value="opponent">Opponent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. +1 234 567 890"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email (Optional)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. john@example.com"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="address">Address (Optional)</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      placeholder="e.g. 123 Legal St, Suite 100"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Party
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredParties.map((party) => (
          <Card key={party.id} className="overflow-hidden hover:shadow-md transition-all border-border/50">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border",
                    party.party_kind === 'client' ? "bg-primary/10 text-primary border-primary/20" : "bg-orange-100 text-orange-600 border-orange-200"
                  )}>
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg leading-none">{party.name}</CardTitle>
                    <Badge variant={party.party_kind === 'client' ? 'default' : 'outline'} className={cn(
                      "text-[10px] uppercase mt-1.5 h-5",
                      party.party_kind === 'opponent' && "border-orange-200 text-orange-700 bg-orange-50"
                    )}>
                      {party.party_kind}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                {party.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{party.phone}</span>
                  </div>
                )}
                {party.address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="line-clamp-1">{party.address}</span>
                  </div>
                )}
                {party.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="w-4 flex justify-center text-xs font-bold">@</span>
                    <span className="truncate">{party.email}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-2">Active Cases</p>
                <div className="space-y-1.5">
                  {party.case_parties && party.case_parties.length > 0 ? (
                    party.case_parties.map((cp) => (
                      <Link
                        key={cp.case_id}
                        href={`/cases/${cp.case_id}`}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/40 hover:bg-muted transition-colors group border border-transparent hover:border-border"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{cp.cases.case_title}</p>
                        </div>
                        <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No linked cases</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredParties.length === 0 && (
        <div className="text-center py-20 bg-muted/10 rounded-xl border border-dashed">
          <User className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="text-lg font-medium">No parties found</h3>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Try adjusting your search or add a new party to the firm directory.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setIsDialogOpen(true)}>
            Add First Party
          </Button>
        </div>
      )}
    </div>
  )
}
