export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: 'admin' | 'lawyer' | 'advocate' | string
  created_at: string
  updated_at: string
  firm_id: string | null
}

export interface Firm {
  id: string
  name: string
  created_at: string
}

export interface Party {
  id: string
  party_kind: 'client' | 'opponent' | null
  name: string
  phone: string | null
  email: string | null
  address: string | null
  created_at: string
  created_by: string | null
  firm_id: string | null
}

export interface Case {
  id: string
  case_uid: string
  case_title: string
  court_name: string | null
  court_city: string | null
  court_state: string | null
  case_type: string | null
  status: 'active' | 'pending' | 'disposed' | 'stay' | 'withdrawn' | 'transferred' | string
  stage: string | null
  priority: 'Routine' | 'Urgent' | 'High' | string | null
  filing_date: string | null
  next_hearing_date: string | null
  assigned_lawyer_id: string | null
  created_by: string | null
  firm_id: string | null
  agreed_fee: number | null
  last_updated_at: string | null
  created_at: string
}

export interface CaseParty {
  id: string
  case_id: string | null
  party_id: string | null
  role_label: string | null
  created_at: string
}

export interface Hearing {
  id: string
  case_id: string | null
  hearing_date: string
  hearing_type: string | null
  court_room: string | null
  notes: string | null
  outcome: string | null
  opponent_appearance: 'present' | 'absent' | string | null
  assigned_advocate_id: string | null
  firm_id: string | null
  created_at: string
}

// Previously 'Document' - renamed to match table 'case_documents' or generic usage
// SQL Table: case_documents
export interface CaseDocument {
  id: string
  case_id: string | null
  title: string
  file_path: string
  file_type: string | null
  uploaded_by: string | null
  category: string | null
  created_at: string
}

export interface CaseExpense {
  id: string
  case_id: string
  added_by: string
  title: string
  description: string | null
  amount: number
  expense_date: string
  category: string | null
  created_at: string
  firm_id: string | null
  // Joins
  added_by_profile?: Profile
}

export interface DiaryNote {
  id: string
  lawyer_id: string | null
  case_id: string | null
  note_date: string
  note_text: string
  priority: 'low' | 'medium' | 'high' | string | null
  task_status: 'pending' | 'done' | string | null
  created_at: string
  // Joins
  case?: Case | null
}

export interface Task {
  id: string
  case_id: string | null
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'completed' | string | null
  priority: 'low' | 'medium' | 'high' | string | null
  due_date: string | null
  assigned_to: string | null
  created_by: string | null
  firm_id: string | null
  created_at: string
  // Joins
  case?: {
    case_title: string
    case_uid: string
  } | null
}

export interface Invoice {
  id: string
  invoice_number: string
  case_id: string | null
  client_id: string | null
  firm_id: string | null
  amount: number
  total_amount: number | null
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | string
  issue_date: string | null
  due_date: string | null
  notes: string | null
  created_at: string
  // Joins
  client?: Party
  case?: Case
  items?: InvoiceItem[]
}

// Not in SQL but often needed for UI if not normalized
export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  created_at: string
}

export interface Payment {
  id: string
  case_id: string | null
  invoice_id: string | null
  amount: number
  status: 'pending' | 'completed' | 'failed' | string
  payment_date: string | null
  payment_method: string | null
  firm_id: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  case_id: string | null
  user_id: string | null
  activity_type: string
  description: string | null
  metadata: Json | null
  firm_id: string | null
  created_at: string
}

export interface CaseMessage {
  id: string
  case_id: string | null
  sender_id: string | null
  message: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string | null
  title: string
  message: string | null
  is_read: boolean
  type: 'info' | 'warning' | 'success' | 'error' | string
  link: string | null
  related_case_id: string | null
  firm_id: string | null
  created_at: string
}

// ------------------------------------------------------------------
// Composite / UI Helper Types
// ------------------------------------------------------------------

export interface CaseWithParties extends Case {
  clients: PartyWithRole[]
  opponents: PartyWithRole[]
  assigned_lawyer?: Profile | null
}

export interface PartyWithRole {
  id: string // case_party id
  party_id: string
  role_label: string | null
  party: Party
}

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

export const CASE_TYPES = [
  'Civil',
  'Criminal',
  'Family',
  'Property',
  'Labour',
  'Consumer',
  'Motor Accident',
  'Writ Petition',
  'Arbitration',
  'Company Matter',
  'Tax',
  'Other'
]

export const CASE_STATUSES = [
  'active',
  'pending',
  'disposed',
  'stay',
  'withdrawn',
  'transferred'
]

export const CASE_STAGES = [
  'Notice',
  'Evidence',
  'Arguments',
  'Order',
  'Judgment',
  'Appeal',
  'Execution'
]

export const PARTY_ROLES = [
  'Petitioner',
  'Respondent',
  'Plaintiff',
  'Defendant',
  'Appellant',
  'Appellee'
]

export const QUICK_TEMPLATES = [
  'Adjourned',
  'Opponent Absent',
  'Notice Issued',
  'Evidence Recorded',
  'Arguments Heard',
  'Next date given',
  'Matter reserved for orders',
  'Cross-examination done',
  'Witness examined',
  'Documents filed'
]
