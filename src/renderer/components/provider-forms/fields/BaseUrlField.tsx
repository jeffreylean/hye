import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Globe } from 'lucide-react'

interface BaseUrlFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function BaseUrlField({ 
  value, 
  onChange, 
  placeholder = 'https://api.openai.com/v1' 
}: BaseUrlFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="baseUrl" className="text-sm flex items-center gap-2">
        <Globe className="h-3.5 w-3.5" />
        Base URL
      </Label>
      <Input
        id="baseUrl"
        type="url"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-sm"
      />
    </div>
  )
}
