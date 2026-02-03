import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // Security check: Only allow requests with the correct CRON_SECRET
    const authHeader = request.headers.get('Authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServiceRoleClient()

    // Call the database function we created
    const { error } = await supabase.rpc('generate_daily_reminders')

    if (error) {
      console.error('Error triggering reminders:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Reminders generated successfully' })
  } catch (error: any) {
    console.error('Unexpected error in daily-reminder-engine:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
