import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const cookies = request.cookies.getAll()
    console.log('API /api/check-cookies:', cookies.map(c => c.name))
    return NextResponse.json({ success: true, data: { cookies: cookies.map(c => c.name) } })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
