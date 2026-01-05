import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useConfigStore, type LLMProviderConfig } from '@/store/configStore'
import { getAllProviders, getProviderForm, getProviderMetadata } from './provider-forms'
import type { LLMProviderType } from '../../shared/types'
import { Bot, Check, Loader2, Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProviderConfig() {
  const { currentProvider, setCurrentProvider, theme, setTheme } = useConfigStore()
  const providers = getAllProviders()
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [selectedType, setSelectedType] = useState<LLMProviderType>('custom')
  const [config, setConfig] = useState<LLMProviderConfig>(() => {
    const metadata = getProviderMetadata('custom')
    return { ...metadata.defaultConfig, apiKey: '' }
  })

  useEffect(() => {
    if (currentProvider) {
      setConfig(currentProvider)
      setSelectedType(currentProvider.type)
    }
  }, [currentProvider])

  const handleProviderChange = (type: LLMProviderType) => {
    const metadata = getProviderMetadata(type)
    setSelectedType(type)
    setConfig({
      ...metadata.defaultConfig,
      apiKey: config.apiKey,
    })
    setTestResult(null)
  }

  const handleSave = () => {
    setCurrentProvider(config)
    setTestResult(null)
  }

  const testProvider = async () => {
    if (!config.apiKey) return

    setIsTesting(true)
    setTestResult(null)

    try {
      const result = await window.electronAPI?.llm?.generate?.(
        [{ role: 'user', content: 'Hi' }],
        {
          provider: config.type,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
        }
      )
      setTestResult(result?.success ? 'success' : 'error')
    } catch {
      setTestResult('error')
    } finally {
      setIsTesting(false)
    }
  }

  const ProviderForm = getProviderForm(selectedType)

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ]

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure your AI provider</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Provider</CardTitle>
            <CardDescription>Select your AI service</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {providers.map((provider) => (
              <button
                key={provider.type}
                onClick={() => handleProviderChange(provider.type)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                  selectedType === provider.type
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    selectedType === provider.type
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{provider.name}</p>
                  <p className="text-xs text-muted-foreground">{provider.description}</p>
                </div>
                {selectedType === provider.type && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription>Enter your API credentials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProviderForm config={config} onChange={setConfig} />

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={testProvider}
                disabled={!config.apiKey || isTesting}
                className="flex-1"
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : testResult === 'success' ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Connected
                  </>
                ) : (
                  'Test'
                )}
              </Button>
              <Button onClick={handleSave} disabled={!config.apiKey} className="flex-1">
                Save
              </Button>
            </div>

            {testResult === 'error' && (
              <p className="text-sm text-destructive">Connection failed. Check your credentials.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Choose your preferred theme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors',
                    theme === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <option.icon
                    className={cn(
                      'h-5 w-5',
                      theme === option.value ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm',
                      theme === option.value ? 'font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
