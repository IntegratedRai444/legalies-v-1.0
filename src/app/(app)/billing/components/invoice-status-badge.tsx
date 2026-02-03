import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type InvoiceStatus = 'Paid' | 'Unpaid' | 'Overdue' | 'Draft' | 'Cancelled'

export function InvoiceStatusBadge({ status }: { status: string }) {
  const statusLower = status.toLowerCase()
  
  const variants: Record<string, string> = {
    paid: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20",
    unpaid: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20",
    overdue: "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-500/20",
    draft: "bg-slate-500/10 text-slate-600 hover:bg-slate-500/20 border-slate-500/20",
    cancelled: "bg-slate-300/10 text-slate-400 hover:bg-slate-300/20 border-slate-300/20",
  }

  return (
    <Badge 
      variant="outline" 
      className={cn("capitalize px-2.5 py-0.5 font-semibold", variants[statusLower] || variants.draft)}
    >
      {status}
    </Badge>
  )
}
