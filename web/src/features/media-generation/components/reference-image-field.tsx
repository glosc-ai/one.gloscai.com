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
import { useRef, type ChangeEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ImagePlus, Upload, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { uploadReferenceImage } from '../api'

type ReferenceImageFieldProps = {
  value: string
  onChange: (value: string) => void
  label: string
  optional?: boolean
}

export function ReferenceImageField(props: ReferenceImageFieldProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const uploadMutation = useMutation({
    mutationFn: uploadReferenceImage,
    onSuccess: (data) => {
      props.onChange(data.url)
      toast.success(t('Image uploaded'))
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('Image upload failed')
      )
    },
  })

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error(t('Please select an image file'))
      return
    }
    uploadMutation.mutate(file)
  }

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between gap-2'>
        <Label>
          {props.optional ? `${props.label} (${t('optional')})` : props.label}
        </Label>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='h-8 gap-2'
          disabled={uploadMutation.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {uploadMutation.isPending ? (
            <Spinner className='size-4' />
          ) : (
            <Upload className='size-4' />
          )}
          {t('Upload')}
        </Button>
      </div>
      <input
        ref={inputRef}
        type='file'
        accept='image/*'
        className='hidden'
        onChange={handleFileChange}
      />
      <Input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder='https://...'
      />
      {props.value ? (
        <div className='border-border bg-muted/20 relative overflow-hidden rounded-lg border'>
          <img
            src={props.value}
            alt={t('Reference image')}
            className='max-h-44 w-full object-contain'
          />
          <Button
            type='button'
            variant='secondary'
            size='icon'
            className='absolute top-2 right-2 size-8'
            onClick={() => props.onChange('')}
            aria-label={t('Remove reference image')}
            title={t('Remove reference image')}
          >
            <X className='size-4' />
          </Button>
        </div>
      ) : (
        <div className='text-muted-foreground flex h-24 items-center justify-center rounded-lg border border-dashed text-sm'>
          <ImagePlus className='mr-2 size-4' />
          {t('No reference image')}
        </div>
      )}
    </div>
  )
}
