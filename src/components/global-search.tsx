'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Briefcase, User, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: string
  type: 'case' | 'party'
  title: string
  subtitle: string
  href: string
}

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const search = async () => {
      if (query.length < 2) {
        setResults([])
        return
      }

      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data)
        setIsOpen(true)
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(search, 300)
    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (href: string) => {
    if (href !== '#') {
      router.push(href)
      setIsOpen(false)
      setQuery('')
    }
  }

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search cases, parties, UIDs..."
          className="pl-10 h-10 w-full bg-muted/50 border-none focus-visible:ring-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
        {query && !loading && (
          <button 
            onClick={() => { setQuery(''); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 w-full mt-2 bg-popover border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-2">
            {results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelect(result.href)}
                className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div className="mt-1">
                  {result.type === 'case' ? (
                    <Briefcase className="w-4 h-4 text-primary" />
                  ) : (
                    <User className="w-4 h-4 text-blue-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{result.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute top-full left-0 w-full mt-2 bg-popover border rounded-xl shadow-xl z-50 p-4 text-center">
          <p className="text-sm text-muted-foreground">No matches found for "{query}"</p>
        </div>
      )}
    </div>
  )
}
