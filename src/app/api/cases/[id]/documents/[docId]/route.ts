import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: caseId, docId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user profile to get firm_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ error: 'No firm associated' }, { status: 403 })
    }

    // Validate firm ownership via case join
    const { data: existingDoc, error: fetchError } = await supabase
      .from('case_documents')
      .select(`
        title,
        category,
        case:cases!inner(firm_id)
      `)
      .eq('id', docId)
      .eq('case_id', caseId)
      .eq('case.firm_id', profile.firm_id)
      .single()

    if (fetchError || !existingDoc) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 })
    }

    const body = await request.json()
    const { title, category } = body

    // Only allow updating title and category
    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (category !== undefined) updateData.category = category

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Update document metadata
    const { data: updatedDoc, error: updateError } = await supabase
      .from('case_documents')
      .update(updateData)
      .eq('id', docId)
      .select()
      .single()

    if (updateError) {
      console.error('Document update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log update to activity_logs
    await logActivity(supabase, {
      case_id: caseId,
      user_id: user.id,
      activity_type: 'document_update',
      description: `updated document "${existingDoc.title}"`,
      metadata: { 
        old_title: existingDoc.title,
        new_title: title || existingDoc.title,
        old_category: existingDoc.category,
        new_category: category || existingDoc.category
      },
      firm_id: profile.firm_id
    })

    return NextResponse.json(updatedDoc)
  } catch (err: any) {
    console.error('Document update error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: caseId, docId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user profile to get firm_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ error: 'No firm associated' }, { status: 403 })
    }

    // Validate firm ownership via case join
    const { data: document, error } = await supabase
      .from('case_documents')
      .select(`
        file_path,
        title,
        case:cases!inner(firm_id)
      `)
      .eq('id', docId)
      .eq('case_id', caseId)
      .eq('case.firm_id', profile.firm_id)
      .single()

    if (error || !document) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 })
    }

    // Delete file from Supabase Storage bucket
    const { error: storageError } = await supabase.storage
      .from('case-documents')
      .remove([document.file_path])

    if (storageError) {
      console.error('Failed to delete file from storage:', storageError)
      // Continue with DB deletion even if storage deletion fails
    }

    // Delete record from case_documents
    const { error: deleteError } = await supabase
      .from('case_documents')
      .delete()
      .eq('id', docId)

    if (deleteError) {
      console.error('Failed to delete document record:', deleteError)
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
    }

    // Log deletion to activity_logs
    await logActivity(supabase, {
      case_id: caseId,
      user_id: user.id,
      activity_type: 'document_delete',
      description: `deleted document "${document.title}"`,
      metadata: { file_name: document.title },
      firm_id: profile.firm_id
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Document deletion error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
