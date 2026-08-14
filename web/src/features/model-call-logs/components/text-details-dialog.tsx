import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Markdown } from '@/components/ui/markdown'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ModelCallLog } from '../types'

type InputMessage = {
  role: string
  content: string
}

const inputRoles = new Set([
  'system',
  'developer',
  'user',
  'assistant',
  'tool',
  'function',
])

function parseInputMessages(value?: string | null): InputMessage[] {
  const lines = (value ?? '').split(/\r?\n/).map((line) => line.trimEnd())
  const messages: InputMessage[] = []
  let currentRole = ''
  let currentContent: string[] = []

  const flush = () => {
    if (!currentRole) return
    messages.push({
      role: currentRole,
      content: currentContent.join('\n').trim(),
    })
  }

  for (const line of lines) {
    const normalized = line.trim().toLowerCase()
    if (inputRoles.has(normalized)) {
      flush()
      currentRole = normalized
      currentContent = []
      continue
    }
    if (currentRole) {
      currentContent.push(line)
    }
  }

  flush()

  if (messages.length === 0 && value?.trim()) {
    return [{ role: '-', content: value.trim() }]
  }

  return messages
}

function InputDetailsTable(props: { label: string; value?: string | null }) {
  const messages = parseInputMessages(props.value)

  return (
    <div className='min-w-0 space-y-2'>
      <div className='text-muted-foreground text-xs font-medium'>
        {props.label}
      </div>
      <ScrollArea className='bg-muted/40 h-44 rounded-md border'>
        {messages.length > 0 ? (
          <Table>
            <TableHeader className='bg-muted/80 sticky top-0 z-10'>
              <TableRow>
                <TableHead className='h-8 w-24 px-3 text-xs'>Role</TableHead>
                <TableHead className='h-8 px-3 text-xs'>Content</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map((message, index) => (
                <TableRow key={`${message.role}-${index}`}>
                  <TableCell className='text-muted-foreground px-3 align-top font-mono text-xs whitespace-nowrap'>
                    {message.role}
                  </TableCell>
                  <TableCell className='px-3 align-top whitespace-normal'>
                    <pre className='text-foreground font-mono text-xs leading-relaxed break-words whitespace-pre-wrap'>
                      {message.content || '-'}
                    </pre>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className='text-muted-foreground p-3 text-xs'>-</div>
        )}
      </ScrollArea>
    </div>
  )
}

function OutputMarkdownBlock(props: { label: string; value?: string | null }) {
  const value = props.value?.trim() || '-'

  return (
    <div className='min-w-0 space-y-2'>
      <div className='text-muted-foreground text-xs font-medium'>
        {props.label}
      </div>
      <ScrollArea className='bg-muted/40 h-44 rounded-md border'>
        <Markdown className='p-3 text-sm'>{value}</Markdown>
      </ScrollArea>
    </div>
  )
}

export function TextDetailsDialog({ log }: { log: ModelCallLog }) {
  const { t } = useTranslation()

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant='ghost'
            size='icon-xs'
            className='text-muted-foreground hover:text-foreground'
            aria-label={t('View details')}
            title={t('View details')}
          />
        }
      >
        <Info />
        <span className='sr-only'>{t('View details')}</span>
      </DialogTrigger>
      <DialogContent className='flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('Details')}</DialogTitle>
        </DialogHeader>
        <div className='grid min-h-0 gap-4 sm:grid-cols-2'>
          <InputDetailsTable label={t('Input')} value={log.input_text} />
          <OutputMarkdownBlock label={t('Output')} value={log.output_text} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
