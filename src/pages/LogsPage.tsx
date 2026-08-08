import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LogsPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('nav.logs')}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('nav.logs')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Coming soon — list + detail pattern will be applied here.</p>
        </CardContent>
      </Card>
    </div>
  )
}
