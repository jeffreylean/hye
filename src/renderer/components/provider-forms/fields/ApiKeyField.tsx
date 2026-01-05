import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Key } from 'lucide-react'

interface ApiKeyFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function ApiKeyField({ value, onChange, placeholder = 'sk-...' }: ApiKeyFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="apiKey" className="text-sm flex items-center gap-2">
        <Key className="h-3.5 w-3.5" />
        API Key
      </Label>
      <Input
        id="apiKey"
        type="password"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-sm"
      />
    </div>
  )
}
