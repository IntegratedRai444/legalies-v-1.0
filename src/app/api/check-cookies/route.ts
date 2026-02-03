import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const cookies = request.cookies.getAll()
  console.log('API /api/check-cookies:', cookies.map(c => c.name))
  return NextResponse.json({ cookies: cookies.map(c => c.name) })
}
