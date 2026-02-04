import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { notifyCaseParticipants } from '@/lib/notifications'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing case ID" }, { status: 400 })
    }

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
      console.error("Documents API error:", error)
      return NextResponse.json({ success: false, error: 'Failed to load documents' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: documents || [] })
  } catch (err) {
    console.error("Documents API error:", err)
    return NextResponse.json({ success: false, error: 'Failed to load documents' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing case ID" }, { status: 400 })
    }
    
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

    // Verify Case belongs to same firm
    const { data: caseRef } = await supabase
      .from('cases')
      .select('id, court_city, court_state')
      .eq('id', id)
      .eq('firm_id', profile.firm_id)
      .single()

    if (!caseRef) {
      return NextResponse.json({ success: false, error: 'Case not found or access denied' }, { status: 404 })
    }

    const body = await request.json()

    // Validate file metadata
    const { file_name, file_path, file_type, category } = body

    if (!file_name || !file_path) {
      return NextResponse.json({ success: false, error: 'File name and path are required' }, { status: 400 })
    }

    // Sanitize file name to prevent path traversal
    const sanitizedName = file_name.replace(/[^a-zA-Z0-9.-_]/g, '_')
    
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ]

    if (file_type && !allowedTypes.includes(file_type)) {
      return NextResponse.json({ 
        success: false,
        error: 'File type not allowed. Allowed types: PDF, DOC, DOCX, JPG, PNG' 
      }, { status: 400 })
    }

    const { data: document, error } = await supabase
      .from('case_documents')
      .insert({
        case_id: id,
        title: sanitizedName,
        file_path: file_path,
        file_type: file_type,
        category: category || 'General',
        uploaded_by: user.id
      })
      .select()
      .single()

    if (error) {
      console.error("Document creation error:", error)
      return NextResponse.json({ success: false, error: 'Failed to create document' }, { status: 500 })
    }

    await logActivity(supabase, {
      case_id: id,
      user_id: user.id,
      activity_type: 'document_upload',
      description: `uploaded document "${sanitizedName}"`,
      metadata: { file_name: sanitizedName, file_type },
      firm_id: profile.firm_id
    })

    await notifyCaseParticipants(supabase, id, {
      exclude_user_id: user.id,
      title: 'New Document Uploaded',
      content: `A new document "${sanitizedName}" was uploaded to the case.`
    })

    return NextResponse.json({ success: true, data: document })
  } catch (err: any) {
    console.error("Documents POST error:", err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
