import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'
import { normalizeRole } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ success: false, error: 'No firm associated' }, { status: 403 })
    }

  const { data: messages, error } = await supabase
      .from('case_messages')
      .select(`
        *,
        sender:profiles(id, full_name),
        case:cases!inner(id, firm_id)
      `)
      .eq('case_id', id)
      .eq('case.firm_id', profile.firm_id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Ensure sender exists for mapping safety
    const sanitizedMessages = (messages || []).map((m: any) => ({
      ...m,
      sender: m.sender || { id: m.sender_id, full_name: 'Unknown User' }
    }))

    return NextResponse.json({ success: true, data: sanitizedMessages })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch profile to get firm_id and role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id, full_name')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ success: false, error: 'No firm associated' }, { status: 403 })
    }

    const body = await request.json()
    const { message } = body

    // Validation
    if (!message || typeof message !== "string") {
      return NextResponse.json({ success: false, error: "Invalid message content" }, { status: 400 })
    }
    if (message.trim().length < 1 || message.length > 1000) {
      return NextResponse.json({ success: false, error: "Message must be 1-1000 characters" }, { status: 400 })
    }

    // Verify case belongs to user's firm
    const { data: caseRecord } = await supabase
      .from('cases')
      .select('id, firm_id')
      .eq('id', id)
      .eq('firm_id', profile.firm_id)
      .single()

    if (!caseRecord) {
      return NextResponse.json({ success: false, error: 'Case not found or access denied' }, { status: 404 })
    }

    const { data: newMessage, error: messageError } = await supabase
      .from('case_messages')
      .insert({
        case_id: id,
        sender_id: user.id,
        message: message.trim()
      })
      .select(`
        *,
        sender:profiles(id, full_name)
      `)
      .single()

    if (messageError) {
      console.error('Message Insert Error:', messageError)
      return NextResponse.json({ success: false, error: messageError.message }, { status: 500 })
    }

    // Handle mentions - Optimized with Batch Fetch
    const mentionRegex = /@(\w+)/g
    const matches = [...new Set(message.match(mentionRegex) || [])] // Unique mentions

    if (matches.length > 0) {
      const usernames = matches.map((m: any) => m.substring(1))

      // Batch fetch mentioned profiles
      const { data: mentionedProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .or(usernames.map(u => `full_name.ilike.%${u}%`).join(','))

      if (mentionedProfiles && mentionedProfiles.length > 0) {
        for (const mentionedUser of mentionedProfiles) {
          // Create mention record
          await supabase.from('message_mentions').insert({
            message_id: newMessage.id,
            mentioned_user_id: mentionedUser.id,
            firm_id: profile.firm_id
          })

          // Create notification
          await createNotification(supabase, {
            user_id: mentionedUser.id,
            title: 'New Mention',
            content: `${profile.full_name || 'Someone'} mentioned you in a case discussion`,
            link: `/cases/${id}`
          })
        }
      }
    }

    return NextResponse.json({ success: true, data: newMessage })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
