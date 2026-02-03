'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  Shield, 
  UserPlus, 
  UserMinus, 
  UserX, 
  UserCheck,
  ChevronLeft
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Profile {
  id: string
  full_name: string
  role: 'admin' | 'advocate'
  is_active: boolean
  phone: string
  created_at: string
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setUsers(data)
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateUser = async (userId: string, updates: Partial<{ role: string, isActive: boolean }>) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...updates })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      
      toast.success('User updated successfully')
      fetchUsers()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user')
    }
  }

  if (loading) return <div className="p-8 animate-pulse space-y-6">
    <div className="h-10 bg-muted rounded w-64" />
    <div className="h-96 bg-muted rounded-xl" />
  </div>

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Firm Member Management</h1>
          <p className="text-muted-foreground mt-1">Manage firm members and their roles</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Firm Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto border rounded-xl">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Joined</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-xs text-muted-foreground">{user.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={user.is_active ? 'outline' : 'destructive'}>
                        {user.is_active ? 'Active' : 'Deactivated'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {user.role === 'advocate' ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleUpdateUser(user.id, { role: 'admin' })}
                          title="Promote to Admin"
                        >
                          <UserPlus className="w-4 h-4 mr-1" />
                          Promote
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleUpdateUser(user.id, { role: 'advocate' })}
                          title="Demote to Advocate"
                        >
                          <UserMinus className="w-4 h-4 mr-1" />
                          Demote
                        </Button>
                      ) }
                      
                      {user.is_active ? (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleUpdateUser(user.id, { isActive: false })}
                        >
                          <UserX className="w-4 h-4 mr-1" />
                          Deactivate
                        </Button>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-green-600 hover:text-green-600 hover:bg-green-50"
                          onClick={() => handleUpdateUser(user.id, { isActive: true })}
                        >
                          <UserCheck className="w-4 h-4 mr-1" />
                          Activate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
