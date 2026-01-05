import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Bot } from 'lucide-react'

interface ModelFieldProps {
  value: string
  onChange: (value: string) => void
  suggestedModels?: string[]
}

export function ModelField({ value, onChange, suggestedModels }: ModelFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="model" className="text-sm flex items-center gap-2">
        <Bot className="h-3.5 w-3.5" />
        Model
      </Label>
      <Input
        id="model"
        placeholder="Model name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-sm"
      />
      {suggestedModels && suggestedModels.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {suggestedModels.join(', ')}
        </p>
      )}
    </div>
  )
}
