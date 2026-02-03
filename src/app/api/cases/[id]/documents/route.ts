import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { notifyCaseParticipants } from '@/lib/notifications'

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

  const { data: documents, error } = await supabase
    .from('case_documents')
    .select(`
      *,
      case:cases!inner(id, firm_id)
    `)
    .eq('case_id', id)
    .eq('case.firm_id', profile.firm_id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(documents)
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
    .select('firm_id')
    .eq('id', user.id)
    .single()

  if (!profile?.firm_id) {
    return NextResponse.json({ error: 'No firm associated' }, { status: 403 })
  }

  // Verify Case belongs to same firm
  const { data: caseRef } = await supabase
    .from('cases')
    .select('id')
    .eq('id', id)
    .eq('firm_id', profile.firm_id)
    .single()

  if (!caseRef) {
    return NextResponse.json({ error: 'Case not found or access denied' }, { status: 404 })
  }

  const body = await request.json()

  const { data: document, error } = await supabase
    .from('case_documents')
    .insert({
      case_id: id,
      title: body.file_name || body.title,
      file_path: body.file_url || body.file_path,
      file_type: body.file_type,
      category: body.category || 'General',
      uploaded_by: user.id
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logActivity(supabase, {
    case_id: id,
    user_id: user.id,
    activity_type: 'document_uploaded',
    description: `uploaded document "${body.file_name}"`,
    firm_id: profile.firm_id
  })

  await notifyCaseParticipants(supabase, id, {
    exclude_user_id: user.id,
    title: 'New Document Uploaded',
    content: `A new document "${body.file_name}" was uploaded to the case.`
  })

  return NextResponse.json(document)
}
