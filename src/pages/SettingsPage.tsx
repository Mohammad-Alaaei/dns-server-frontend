import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.theme')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(['light', 'dark', 'system'] as const).map((mode) => (
            <Button
              key={mode}
              variant={theme === mode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme(mode)}
            >
              {t(`common.${mode}`)}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.language')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="mb-2 block">{t('common.language')}</Label>
          <select
            className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
          >
            <option value="en">English</option>
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            Language preference will also be saved to backend user settings.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
