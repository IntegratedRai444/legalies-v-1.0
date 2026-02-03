# Legalies Management System (Legalies)

Smart Case Management for Modern Law Firms. A premium Legal Practice Operating System built with Next.js, TypeScript, TailwindCSS, and Supabase.

## Features

- **Case Management**: Add, view, edit, and search cases with client/opponent details
- **Hearing System**: Track hearing history with auto-updating next hearing dates
- **Legal CRM (Clients & Opponents)**: Manage clients and opponents across all cases
- **Daily Diary**: Weekly agenda view with task management and priorities
- **Unified Timeline**: Chronological view of all case activities (hearings, notes, documents)
- **Document Vault**: Securely manage and organize case documents
- **Global Search**: Find cases and parties instantly across the entire system
- **Mobile-First Design**: Responsive UI optimized for advocates on-the-go

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, TailwindCSS, Shadcn/UI
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage

### Note on Dependencies
The project currently includes `drizzle-orm` and `better-auth` as dependencies. 
- **Better Auth**: Planned for future integration; current authentication is handled strictly by Supabase Auth.
- **Drizzle ORM**: Planned for schema migrations and type-safe querying; current implementation uses Supabase SDK directly.

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or bun
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd legalies-management-system
```

2. Install dependencies:
```bash
npm install
# or
bun install
```

3. Set up environment variables:

Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

4. Run the development server:
```bash
npm run dev
# or
bun dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## License

MIT
