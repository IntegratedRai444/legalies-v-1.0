'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { CaseWithParties, Hearing, DiaryNote } from '@/lib/types'
import { Scale, MapPin, Building, Calendar, User, Briefcase } from 'lucide-react'

interface CasePrintClientProps {
  caseId: string
}

export default function CasePrintClient({ caseId }: CasePrintClientProps) {
  const supabase = createClient()
  const [caseData, setCaseData] = useState<CaseWithParties | null>(null)
  const [hearings, setHearings] = useState<Hearing[]>([])
  const [diaryNotes, setDiaryNotes] = useState<DiaryNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [caseRes, hearingsRes, notesRes] = await Promise.all([
          fetch(`/api/cases/${caseId}`, { credentials: 'include' }).then(res => res.json()),
          fetch(`/api/cases/${caseId}/hearings`, { credentials: 'include' }).then(res => res.json()),
          fetch(`/api/diary?case_id=${caseId}`, { credentials: 'include' }).then(res => res.json())
        ])

        setCaseData(caseRes.success ? caseRes.data : caseRes)
        setHearings(Array.isArray(hearingsRes) ? hearingsRes : [])
        setDiaryNotes(Array.isArray(notesRes) ? notesRes : [])
      } catch (error) {
        console.error('Error loading print data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [caseId])

  useEffect(() => {
    if (!loading && caseData) {
      // Small delay to ensure images/fonts are ready if any
      setTimeout(() => {
        window.print()
      }, 500)
    }
  }, [loading, caseData])

  if (loading) return <div className="p-8 text-center">Loading report...</div>
  if (!caseData) return <div className="p-8 text-center">Case not found</div>

  return (
    <div className="bg-white text-black p-8 max-w-4xl mx-auto print:p-0">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-8 h-8" />
            <h1 className="text-3xl font-bold uppercase tracking-tight">Legalies Management System</h1>
          </div>
          <p className="text-sm font-semibold text-gray-600 uppercase">Professional Case Summary Report</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Report Generated</p>
          <p className="font-bold">{format(new Date(), 'MMMM d, yyyy')}</p>
        </div>
      </div>

      {/* Case Header Info */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Case Details</h2>
          <h3 className="text-2xl font-bold mb-2">{caseData.case_title}</h3>
          <p className="text-xl font-mono font-bold text-gray-700">{caseData.case_uid}</p>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Building className="w-4 h-4" />
              <span className="font-bold">Court:</span> {caseData.court_name || 'N/A'}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4" />
              <span className="font-bold">Location:</span> {[caseData.court_city, caseData.court_state].filter(Boolean).join(', ') || 'N/A'}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="w-4 h-4" />
              <span className="font-bold">Type:</span> {caseData.case_type || 'N/A'}
            </div>
          </div>
        </div>
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Status & Assignment</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Current Status</p>
              <p className="text-lg font-bold">{caseData.status}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Procedural Stage</p>
              <p className="text-lg font-bold">{caseData.stage}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Assigned Advocate</p>
              <p className="text-lg font-bold">{caseData.assigned_lawyer?.full_name || 'Unassigned'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-8 mb-12">
        <section>
          <h2 className="text-lg font-bold border-b-2 border-gray-200 pb-2 mb-4 uppercase">Clients (Petitioners)</h2>
          <div className="space-y-4">
            {caseData.clients?.map(c => (
              <div key={c.id} className="border-l-4 border-black pl-4">
                <p className="font-bold">{c.party.name}</p>
                <p className="text-sm text-gray-600">{c.role_label}</p>
                {c.party.phone && <p className="text-xs text-gray-500 mt-1">{c.party.phone}</p>}
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-lg font-bold border-b-2 border-gray-200 pb-2 mb-4 uppercase">Opponents (Respondents)</h2>
          <div className="space-y-4">
            {caseData.opponents?.map(o => (
              <div key={o.id} className="border-l-4 border-gray-300 pl-4">
                <p className="font-bold">{o.party.name}</p>
                <p className="text-sm text-gray-600">{o.role_label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Hearings */}
      <section className="mb-12">
        <h2 className="text-lg font-bold border-b-2 border-gray-200 pb-2 mb-4 uppercase">Hearing History & Outcomes</h2>
        <div className="space-y-6">
          {hearings.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No hearing records available.</p>
          ) : (
            hearings?.map(h => (
              <div key={h.id} className="grid grid-cols-[150px_1fr] gap-4">
                <div className="font-bold text-sm">
                  {format(parseISO(h.hearing_date), 'MMM d, yyyy')}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm underline">{h.hearing_type || 'Hearing'}</span>
                    {h.court_room && <span className="text-xs text-gray-500">• {h.court_room}</span>}
                  </div>
                  <p className="text-sm text-gray-700">{h.outcome || 'No notes recorded.'}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Notes */}
      <section className="mb-12">
        <h2 className="text-lg font-bold border-b-2 border-gray-200 pb-2 mb-4 uppercase">Internal Case Notes</h2>
        <div className="space-y-4">
          {diaryNotes.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No internal notes available.</p>
          ) : (
            diaryNotes?.map(n => (
              <div key={n.id} className="bg-gray-50 p-4 rounded border border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase">{format(parseISO(n.note_date), 'MMMM d, yyyy')}</p>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-200">{n.priority} Priority</span>
                </div>
                <p className="text-sm leading-relaxed">{n.note_text}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Footer */}
      <div className="mt-20 pt-8 border-t border-gray-200 text-center text-[10px] text-gray-400 uppercase tracking-widest">
        End of Case Summary Report • Confidential • Legalies Management System
      </div>

      <style jsx global>{`
        @media print {
          @page {
            margin: 20mm;
          }
          body {
            background: white;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
