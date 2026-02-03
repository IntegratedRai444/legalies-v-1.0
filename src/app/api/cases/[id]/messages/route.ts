import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'
import { normalizeRole } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  if (!profile?.firm_id) {
    return NextResponse.json({ error: 'No firm associated' }, { status: 403 })
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Ensure sender exists for mapping safety
  const sanitizedMessages = (messages || []).map((m: any) => ({
    ...m,
    sender: m.sender || { id: m.sender_id, full_name: 'Unknown User' }
  }))

  return NextResponse.json(sanitizedMessages)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, firm_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.firm_id) {
    return NextResponse.json({ error: 'No firm associated' }, { status: 403 })
  }

  const body = await request.json()
  const { message } = body

  if (!message) {
    return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
  }

  // Step 7: Permissions - Only assigned advocates or admins can post
  // AND firm must match
  const { data: caseData } = await supabase
    .from('cases')
    .select('assigned_lawyer_id, created_by, firm_id')
    .eq('id', id)
    .eq('firm_id', profile.firm_id)
    .single()

  if (!caseData) {
    return NextResponse.json({ error: 'Case not found or access denied' }, { status: 404 })
  }

  const isAssigned = caseData.assigned_lawyer_id === user.id || caseData.created_by === user.id
  const isAdmin = normalizeRole(profile?.role || '') === 'admin'

  if (!isAssigned && !isAdmin) {
    return NextResponse.json({ error: 'Only assigned advocates or admins can post messages' }, { status: 403 })
  }

  // Insert message
  const { data: newMessage, error: messageError } = await supabase
    .from('case_messages')
    .insert({
      case_id: id,
      sender_id: user.id,
      message,
      firm_id: profile.firm_id
    })
    .select(`
      *,
      sender:profiles(id, full_name)
    `)
    .single()

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 500 })
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

  return NextResponse.json(newMessage)
}
