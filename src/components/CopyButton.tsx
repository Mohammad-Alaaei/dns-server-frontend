import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  text: string
  /** Always visible (detail pages). Default: parent group-hover only. */
  alwaysVisible?: boolean
  className?: string
  size?: 'sm' | 'default'
}

/** Copies `text` to clipboard. Stops row click propagation. */
export function CopyButton({
  text,
  alwaysVisible = false,
  className,
  size = 'sm',
}: CopyButtonProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
        'shrink-0 cursor-pointer text-muted-foreground hover:text-foreground',
        !alwaysVisible &&
          'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity',
        className
      )}
      onClick={handleCopy}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={copied ? t('common.copied') : t('common.copy')}
      title={copied ? t('common.copied') : t('common.copy')}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}
