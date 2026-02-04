import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { normalizeRole } from '@/lib/utils'

const normalize = (v?: string) => v?.toLowerCase().trim()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, messageId: string }> }
) {
  try {
    const { id: caseId, messageId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ error: 'No firm associated' }, { status: 403 })
    }

    // Validate message belongs to case in same firm
    const { data: existingMessage, error: fetchError } = await supabase
      .from('case_messages')
      .select(`
        message,
        sender_id,
        case:cases!inner(firm_id)
      `)
      .eq('id', messageId)
      .eq('case_id', caseId)
      .eq('case.firm_id', profile.firm_id)
      .single()

    if (fetchError || !existingMessage) {
      return NextResponse.json({ error: 'Message not found or access denied' }, { status: 404 })
    }

    // Ownership check - only sender or admin can edit
    const isAdmin = normalize(profile.role) === 'admin'
    const isSender = existingMessage.sender_id === user.id

    if (!isSender && !isAdmin) {
      return NextResponse.json({ error: 'Only message sender or admin can edit messages' }, { status: 403 })
    }

    const body = await request.json()
    const { message } = body

    if (!message || message.trim() === '') {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    // Update message
    const { data: updatedMessage, error: updateError } = await supabase
      .from('case_messages')
      .update({ message: message.trim() })
      .eq('id', messageId)
      .select(`
        *,
        sender:profiles(id, full_name)
      `)
      .single()

    if (updateError) {
      console.error('Message update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log activity
    await logActivity(supabase, {
      case_id: caseId,
      user_id: user.id,
      activity_type: 'message_update',
      description: `edited message in case discussion`,
      metadata: { 
        old_message: existingMessage.message,
        new_message: message.trim()
      },
      firm_id: profile.firm_id
    })

    return NextResponse.json(updatedMessage)
  } catch (err: any) {
    console.error('Message update error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, messageId: string }> }
) {
  try {
    const { id: caseId, messageId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ error: 'No firm associated' }, { status: 403 })
    }

    // Validate message belongs to case in same firm
    const { data: existingMessage, error: fetchError } = await supabase
      .from('case_messages')
      .select(`
        message,
        sender_id,
        case:cases!inner(firm_id)
      `)
      .eq('id', messageId)
      .eq('case_id', caseId)
      .eq('case.firm_id', profile.firm_id)
      .single()

    if (fetchError || !existingMessage) {
      return NextResponse.json({ error: 'Message not found or access denied' }, { status: 404 })
    }

    // Ownership check - only sender or admin can delete
    const isAdmin = normalize(profile.role) === 'admin'
    const isSender = existingMessage.sender_id === user.id

    if (!isSender && !isAdmin) {
      return NextResponse.json({ error: 'Only message sender or admin can delete messages' }, { status: 403 })
    }

    // Delete related mentions first
    await supabase
      .from('message_mentions')
      .delete()
      .eq('message_id', messageId)

    // Delete the message
    const { error: deleteError } = await supabase
      .from('case_messages')
      .delete()
      .eq('id', messageId)

    if (deleteError) {
      console.error('Message delete error:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Log activity
    await logActivity(supabase, {
      case_id: caseId,
      user_id: user.id,
      activity_type: 'message_delete',
      description: `deleted message from case discussion`,
      metadata: { deleted_message: existingMessage.message },
      firm_id: profile.firm_id
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Message delete error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
