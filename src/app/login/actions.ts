'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  let success = false
  
    try {
      console.log('--- LOGIN ACTION START ---')
      const email = formData.get('email') as string
      const password = formData.get('password') as string
      
      console.log('Login attempt for:', email)
      
      if (!email || !password) {
        console.log('Missing email or password')
        return { error: 'Email and password are required' }
      }
      
      const supabase = await createServerSupabaseClient()
      console.log('Supabase client created')

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Supabase auth error:', error.message)
        return { error: error.message }
      }
      
      if (data?.user) {
        console.log('Login successful for:', data.user.id)
        success = true
      } else {
        console.log('No user returned from Supabase')
        return { error: 'Invalid login credentials' }
      }
    } catch (err: any) {
      console.error('Login action CRASH:', err)
      return { error: 'An unexpected error occurred during login.' }
    }


    if (success) {
      console.log('Redirecting to dashboard...')
      redirect('/dashboard')
    }
    
    return { error: null }
}
