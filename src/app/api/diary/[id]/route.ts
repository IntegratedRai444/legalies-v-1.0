import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const normalize = (v?: string) => v?.toLowerCase().trim()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Verify ownership and firm isolation
    const { data: existingNote } = await supabase
      .from('diary_notes')
      .select('id, lawyer_id, case:cases!inner(firm_id)')
      .eq('id', id)
      .eq('case.firm_id', profile.firm_id)
      .single()

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found or access denied' }, { status: 404 })
    }

    const isAdmin = normalize(profile.role) === 'admin'
    const isOwner = existingNote.lawyer_id === user.id

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    const { data: note, error } = await supabase
      .from('diary_notes')
      .update(body)
      .eq('id', id)
      .select(`
        *,
        case:cases(id, case_uid, case_title)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(note)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Verify ownership and firm isolation
    const { data: existingNote } = await supabase
      .from('diary_notes')
      .select('id, lawyer_id, case:cases!inner(firm_id)')
      .eq('id', id)
      .eq('case.firm_id', profile.firm_id)
      .single()

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found or access denied' }, { status: 404 })
    }

    const isAdmin = normalize(profile.role) === 'admin'
    const isOwner = existingNote.lawyer_id === user.id

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('diary_notes')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
