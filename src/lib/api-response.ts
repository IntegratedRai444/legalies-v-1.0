import { NextResponse } from 'next/server'

export interface ApiResponse<T = any> {
  data: T | null
  error: string | null
}

export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json({ data, error: null }, { status })
}

export function errorResponse(message: string, status: number = 500) {
  return NextResponse.json({ data: null, error: message }, { status })
}
