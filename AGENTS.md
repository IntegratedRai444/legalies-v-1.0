## Project Summary
Legalies Management System (Legalies) is a premium Legal Practice Operating System designed for modern law firms and independent advocates. It provides a complete suite for Case Management, Hearing Calendars, Legal CRM (Clients & Opponents), and Billing System.

## Tech Stack
- Framework: Next.js 15 (App Router)
- Database & Auth: Supabase
- Styling: Tailwind CSS
- Icons: Lucide React
- Components: shadcn/ui

## Architecture
- `src/app`: Next.js App Router for pages and API routes.
- `src/components`: Reusable UI components.
- `src/lib/supabase`: Supabase client configuration.
- `src/hooks`: Custom React hooks for data fetching and state management.

## User Preferences
- **Brand Name**: Legalies Management System (Short: Legalies)
- **Tagline**: Smart Case Management for Modern Law Firms
- Use Supabase for Auth, Database, and Storage.
- Maintain a professional, premium UI/UX.
- Use full name "Legalies Management System" on login/footer, and "Legalies" in navbar/dashboard.
- **Internal Model**: The system is strictly for internal firm use. No client portals or external payment integrations (like Stripe) are required.
- **Terminology**: Use professional legal terminology consistently:
  - Navigation: Today’s Agenda, Clients & Opponents, Billing System, Admin Dashboard, Case Journal.
  - Page Titles: Cases Register, Firm Calendar, All Tasks.
  - Actions: Add Journal Entry, Case Document, Action Items (case view), Firm Member (admin).
  - Buttons: Add New Case, Add [Entity], Save Changes, Create Case (form only).
  - Case Status: Active, Pending, Disposed, Stay, Withdrawn, Transferred.
  - Case Stage: Notice, Evidence, Arguments, Order, Judgment, Appeal, Execution.

## Project Guidelines
- Row Level Security (RLS) is enabled on all tables with strict access policies.
- Users can only access data (cases, hearings, tasks, etc.) they created or are assigned to.
- Profiles are publicly readable by authenticated users to support collaboration and assignment.
- Use functional components and modern React patterns.
- Follow a clean, modern aesthetic with clear typography and sharp accents.
- No comments unless requested.

## Common Patterns
- API routes in `src/app/api` for server-side operations.
- Client-side data fetching using custom hooks or direct Supabase client.
