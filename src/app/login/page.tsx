'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Scale, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (isPending) return
    
    setIsPending(true)
    console.log('Login attempt started for:', email)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()
      console.log('Login response:', response.status, data)

      if (!response.ok) {
        toast.error(data.error || 'Login failed')
        setIsPending(false)
        return
      }

      toast.success('Logged in successfully!')
      console.log('Redirecting to dashboard...')
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Login error:', error)
      toast.error('An unexpected error occurred')
      setIsPending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#faf8f5] via-[#f5f1eb] to-[#e8e2d9]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>
      
      <Card className="w-full max-w-md relative shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-4 text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-2xl legal-gradient flex items-center justify-center shadow-lg">
            <Scale className="w-8 h-8 text-primary-foreground" />
          </div>
            <div>
              <CardTitle className="text-3xl font-bold tracking-tight">Legalies Management System</CardTitle>
              <CardDescription className="text-base mt-2">Sign in to manage your cases</CardDescription>
            </div>
        </CardHeader>
        
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="lawyer@example.com"
                required
                className="h-12 text-base"
                disabled={isPending}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  required
                  className="h-12 text-base pr-12"
                  disabled={isPending}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isPending}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col gap-4 pt-2">
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold legal-gradient hover:opacity-90 transition-opacity"
              disabled={isPending}
            >
              {isPending ? 'Signing in...' : 'Sign In'}
            </Button>
            
            <p className="text-sm text-muted-foreground text-center">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-primary font-semibold hover:underline">
                Register here
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
