import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SystemPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('nav.system')}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('nav.system')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Coming soon — system actions (flush / reload) will be here.</p>
        </CardContent>
      </Card>
    </div>
  )
}
