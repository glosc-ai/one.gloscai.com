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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Markdown } from '@/components/ui/markdown'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type MarkdownEditorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  value: string
  onSave: (value: string) => void
  placeholder?: string
  rows?: number
}

export function MarkdownEditorDialog({
  open,
  onOpenChange,
  title,
  description,
  value,
  onSave,
  placeholder,
  rows = 12,
}: MarkdownEditorDialogProps) {
  const { t } = useTranslation()
  const [editValue, setEditValue] = useState(value)

  const handleSave = () => {
    onSave(editValue)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <Tabs defaultValue='edit'>
          <TabsList>
            <TabsTrigger value='edit'>{t('Edit')}</TabsTrigger>
            <TabsTrigger value='preview'>{t('Preview')}</TabsTrigger>
          </TabsList>

          <TabsContent value='edit' className='mt-3'>
            <ScrollArea className='max-h-100 rounded-md border'>
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                className='font-mono text-sm max-h-40 resize-none border-0 shadow-none'
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent value='preview' className='mt-3'>
            <ScrollArea className='max-h-100  rounded-md border p-4'>
              {editValue ? (
                <Markdown>{editValue}</Markdown>
              ) : (
                <p className='text-muted-foreground text-sm'>
                  {t('No content to preview')}
                </p>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button type='button' onClick={handleSave}>
            {t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
