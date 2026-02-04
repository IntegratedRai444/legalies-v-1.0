import { NextResponse } from 'next/server'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function errorResponse(message: string, status: number = 500) {
  return NextResponse.json({ success: false, error: message }, { status })
}
