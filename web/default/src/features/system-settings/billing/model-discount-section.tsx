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
import { useCallback, useMemo, useState } from 'react'
import { Code2, Copy, Eye, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TitledCard } from '@/components/ui/titled-card'
import { StaticDataTable } from '@/components/data-table'
import { useUpdateOption } from '../hooks/use-update-option'

const OPTION_KEY = 'billing_setting.model_discounts'

type ModelDiscountConfig = {
  discount: number
  end_time?: number
}

type ModelDiscountRow = {
  id: number
  model: string
  discount: number
  endTime: string
}

type ModelDiscountSectionProps = {
  defaultValue: string
}

function endTimeToInputValue(endTime?: number) {
  if (!endTime) return ''
  const date = new Date(endTime * 1000)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function inputValueToEndTime(value: string) {
  if (!value) return 0
  const timestamp = Math.floor(new Date(value).getTime() / 1000)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function normalizeDiscount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1
  return value
}

function rowsToObject(
  rows: ModelDiscountRow[]
): Record<string, ModelDiscountConfig> {
  const discounts: Record<string, ModelDiscountConfig> = {}
  for (const row of rows) {
    const model = row.model.trim()
    if (!model) continue
    const endTime = inputValueToEndTime(row.endTime)
    discounts[model] = {
      discount: normalizeDiscount(Number(row.discount)),
      ...(endTime > 0 ? { end_time: endTime } : {}),
    }
  }
  return discounts
}

function objectToRows(
  discounts: Record<string, ModelDiscountConfig>
): ModelDiscountRow[] {
  return Object.entries(discounts).map(([model, config], index) => ({
    id: index + 1,
    model,
    discount: normalizeDiscount(Number(config?.discount)),
    endTime: endTimeToInputValue(config?.end_time),
  }))
}

function parseInitialDiscounts(
  rawValue: string | undefined
): Record<string, ModelDiscountConfig> {
  if (!rawValue) return {}
  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, ModelDiscountConfig>
    }
  } catch {
    // fall through to empty config
  }
  return {}
}

export function ModelDiscountSection({
  defaultValue,
}: ModelDiscountSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [editMode, setEditMode] = useState<'visual' | 'json'>('visual')
  const [rows, setRows] = useState<ModelDiscountRow[]>(() =>
    objectToRows(parseInitialDiscounts(defaultValue))
  )
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(parseInitialDiscounts(defaultValue), null, 2)
  )
  const [jsonError, setJsonError] = useState('')
  const [nextRowId, setNextRowId] = useState(() => rows.length + 1)

  const currentDiscounts = useMemo(() => rowsToObject(rows), [rows])

  const syncFromRows = useCallback((nextRows: ModelDiscountRow[]) => {
    setRows(nextRows)
    setJsonText(JSON.stringify(rowsToObject(nextRows), null, 2))
    setJsonError('')
  }, [])

  const handleJsonChange = useCallback(
    (text: string) => {
      setJsonText(text)
      try {
        const parsed = JSON.parse(text) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setJsonError(t('JSON must be an object'))
          return
        }
        const nextRows = objectToRows(
          parsed as Record<string, ModelDiscountConfig>
        )
        setRows(nextRows)
        setNextRowId(nextRows.length + 1)
        setJsonError('')
      } catch (error) {
        setJsonError(error instanceof Error ? error.message : t('Invalid JSON'))
      }
    },
    [t]
  )

  const updateRow = useCallback(
    (
      id: number,
      field: 'model' | 'discount' | 'endTime',
      value: string | number
    ) => {
      syncFromRows(
        rows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
      )
    },
    [rows, syncFromRows]
  )

  const addRow = useCallback(() => {
    const newRow: ModelDiscountRow = {
      id: nextRowId,
      model: '',
      discount: 0.8,
      endTime: '',
    }
    setNextRowId((prev) => prev + 1)
    syncFromRows([...rows, newRow])
  }, [nextRowId, rows, syncFromRows])

  const removeRow = useCallback(
    (id: number) => {
      syncFromRows(rows.filter((row) => row.id !== id))
    },
    [rows, syncFromRows]
  )

  const handleCopyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonText)
      toast.success(t('Copied to clipboard'))
    } catch {
      toast.error(t('Failed to copy'))
    }
  }, [jsonText, t])

  const handleSave = useCallback(async () => {
    if (editMode === 'json' && jsonError) {
      toast.error(t('Please fix JSON errors before saving'))
      return
    }
    await updateOption.mutateAsync({
      key: OPTION_KEY,
      value: JSON.stringify(currentDiscounts),
    })
  }, [currentDiscounts, editMode, jsonError, t, updateOption])

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => (prev === 'visual' ? 'json' : 'visual'))
  }, [])

  return (
    <TitledCard
      title={t('Model Discounts')}
      description={t(
        'Apply temporary or permanent discounts after model and group pricing.'
      )}
      contentClassName='space-y-4'
    >
      <Alert>
        <AlertDescription className='space-y-1 text-sm'>
          <div>
            {t(
              'Enter the model name, discount multiplier, and optional end time. Leave end time empty for a permanent discount.'
            )}
          </div>
          <div>
            <span className='font-medium'>{t('Example')}:</span>{' '}
            <code className='bg-muted rounded px-1 py-0.5 text-xs'>0.8</code>{' '}
            {t('means 20% off.')}
          </div>
        </AlertDescription>
      </Alert>

      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          {editMode === 'visual' ? (
            <Button variant='outline' size='sm' onClick={addRow}>
              <Plus className='mr-2 h-4 w-4' />
              {t('Add')}
            </Button>
          ) : (
            <Button variant='ghost' size='sm' onClick={handleCopyJson}>
              <Copy className='mr-2 h-4 w-4' />
              {t('Copy')}
            </Button>
          )}
        </div>
        <Button variant='outline' size='sm' onClick={toggleEditMode}>
          {editMode === 'visual' ? (
            <>
              <Code2 className='mr-2 h-4 w-4' />
              {t('Switch to JSON')}
            </>
          ) : (
            <>
              <Eye className='mr-2 h-4 w-4' />
              {t('Switch to Visual')}
            </>
          )}
        </Button>
      </div>

      {editMode === 'visual' ? (
        <StaticDataTable
          data={rows}
          getRowKey={(row) => row.id}
          emptyClassName='text-muted-foreground py-8'
          emptyContent={t('No model discounts configured')}
          columns={[
            {
              id: 'model',
              header: t('Model'),
              cell: (row) => (
                <Input
                  value={row.model}
                  placeholder='gpt-4o'
                  onChange={(e) => updateRow(row.id, 'model', e.target.value)}
                />
              ),
            },
            {
              id: 'discount',
              header: t('Discount'),
              className: 'w-[160px]',
              cell: (row) => (
                <Input
                  type='number'
                  min={0.0001}
                  step={0.01}
                  value={row.discount}
                  onChange={(e) =>
                    updateRow(
                      row.id,
                      'discount',
                      Number(e.target.value) || 1
                    )
                  }
                />
              ),
            },
            {
              id: 'endTime',
              header: t('End Time'),
              className: 'w-[230px]',
              cell: (row) => (
                <Input
                  type='datetime-local'
                  value={row.endTime}
                  onChange={(e) =>
                    updateRow(row.id, 'endTime', e.target.value)
                  }
                />
              ),
            },
            {
              id: 'actions',
              header: t('Actions'),
              className: 'w-[80px] text-right',
              cellClassName: 'text-right',
              cell: (row) => (
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => removeRow(row.id)}
                  aria-label={t('Delete')}
                >
                  <Trash2 className='text-destructive h-4 w-4' />
                </Button>
              ),
            },
          ]}
        />
      ) : (
        <div className='space-y-2'>
          <Textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            className='font-mono text-sm'
            rows={12}
            spellCheck={false}
          />
          {jsonError && <p className='text-destructive text-sm'>{jsonError}</p>}
        </div>
      )}

      <div className='flex justify-end'>
        <Button
          onClick={handleSave}
          disabled={
            updateOption.isPending || (editMode === 'json' && !!jsonError)
          }
        >
          {t('Save model discounts')}
        </Button>
      </div>
    </TitledCard>
  )
}
