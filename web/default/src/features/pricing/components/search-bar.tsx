/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SearchBarProps {
  value: string
  onSearch: (value: string) => void
  onClear: () => void
  placeholder?: string
  className?: string
}

export function SearchBar(props: SearchBarProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState(props.value)

  useEffect(() => {
    // Keep the input aligned with URL changes such as browser navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue(props.value)
  }, [props.value])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    props.onSearch(inputValue)
  }

  function handleClear() {
    setInputValue('')
    props.onClear()
    inputRef.current?.focus()
  }

  return (
    <form className={cn('flex gap-2', props.className)} onSubmit={handleSubmit}>
      <div className='relative min-w-0 flex-1'>
        <Search className='text-muted-foreground/60 pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2' />
        <input
          ref={inputRef}
          type='text'
          placeholder={props.placeholder || t('Search models...')}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          className={cn(
            'border-border/60 bg-background placeholder:text-muted-foreground/50',
            'hover:border-border',
            'focus:border-primary/50 focus:ring-primary/20 focus:ring-2',
            'h-10 w-full rounded-lg border pr-11 pl-10 text-sm transition-all outline-none'
          )}
          aria-label={t('Search models')}
        />
        {inputValue && (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={handleClear}
            className='text-muted-foreground/60 hover:text-foreground absolute top-1/2 right-2.5 size-7 -translate-y-1/2'
            aria-label={t('Clear search')}
          >
            <X className='size-4' />
          </Button>
        )}
      </div>
      <Button type='submit' className='h-10 shrink-0 px-4'>
        {t('Search')}
      </Button>
    </form>
  )
}
