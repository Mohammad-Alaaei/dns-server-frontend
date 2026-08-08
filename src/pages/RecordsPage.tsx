import { useTranslation } from 'react-i18next'
import { MoreHorizontal, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function RecordsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('records.title')}</h1>
        <Button>{t('common.create')}</Button>
      </div>

      {/* Toolbar: search / sort / filter (UI only) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-9" placeholder={t('common.search')} disabled />
        </div>
        <Button variant="outline" disabled>{t('common.sort')}</Button>
        <Button variant="outline" disabled>{t('common.filter')}</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('records.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="hidden md:grid grid-cols-5 gap-4 border-b bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground">
              <div>{t('records.domain')}</div>
              <div>{t('records.ip')}</div>
              <div>{t('records.source')}</div>
              <div>{t('records.enabled')}</div>
              <div className="text-end">{t('common.actions')}</div>
            </div>
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p>{t('common.noResults')}</p>
              <p className="text-xs mt-1">List will load from /api/records</p>
            </div>
          </div>
          {/* Pagination placeholder */}
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{t('common.rowsPerPage')}: 20</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>{t('common.previous')}</Button>
              <Button variant="outline" size="sm" disabled>{t('common.next')}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
