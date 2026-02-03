import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeStatus(s: string) {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export function normalizeRole(r: string) {
  if (!r) return r
  const role = r.toLowerCase()
  // Maintain backward compatibility with 'lawyer' if it exists in DB, but prefer 'advocate'
  if (role === 'lawyer' || role === 'advocate') return 'advocate'
  return role
}
