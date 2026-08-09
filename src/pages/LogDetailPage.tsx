import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { getLogFileTail, type LogFileDetail } from '@/api/logs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Loading } from '@/components/Loading'
import { NoResult } from '@/components/NoResult'

const TAIL_OPTIONS = [100, 200, 500, 1000, 2000] as const

export default function LogDetailPage() {
  const { t } = useTranslation()
  const { filename: filenameParam } = useParams<{ filename: string }>()
  const navigate = useNavigate()
  const preRef = useRef<HTMLPreElement>(null)

  const filename = filenameParam ? decodeURIComponent(filenameParam) : ''

  const [data, setData] = useState<LogFileDetail | null>(null)
  const [tailLines, setTailLines] = useState(200)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)

  const load = useCallback(async () => {
    if (!filename) {
      setError(t('common.error'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await getLogFileTail(filename, tailLines)
      setData(res)
    } catch {
      setError(t('common.error'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [filename, tailLines, t])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (autoScroll && preRef.current && data?.lines?.length) {
      preRef.current.scrollTop = preRef.current.scrollHeight
    }
  }, [data, autoScroll])

  function handleBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/logs')
  }

  if (loading && !data) {
    return <Loading />
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <Button
          variant="secondary"
          className="cursor-pointer bg-muted hover:bg-muted/80"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t('nav.logs'), to: '/logs' },
          { label: filename || '…' },
        ]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 min-w-0">
          <Button
            variant="secondary"
            className="cursor-pointer bg-muted hover:bg-muted/80 font-medium"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight font-mono break-all">
            {filename}
          </h1>
          <div className="flex flex-wrap gap-2">
            {data?.current && <Badge variant="success">{t('logs.current')}</Badge>}
            {data?.meta && (
              <Badge variant="outline">
                {t('logs.showing')} {data.meta.from + 1}–{data.meta.to} / {data.meta.total}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('logs.tail')}</span>
            <select
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              value={tailLines}
              onChange={(e) => setTailLines(Number(e.target.value))}
            >
              {TAIL_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            {t('logs.autoScroll')}
          </label>
          <Button variant="outline" size="sm" disabled={loading} onClick={load}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('logs.refresh')}
          </Button>
        </div>
      </div>

      <div className="border-t" />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('logs.content')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !data?.lines?.length ? (
            <Loading fullScreen={false} />
          ) : !data?.lines?.length ? (
            <NoResult fullScreen={false} />
          ) : (
            <pre
              ref={preRef}
              className="max-h-[min(70vh,48rem)] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all"
            >
              {data.lines.join('\n')}
            </pre>
          )}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
