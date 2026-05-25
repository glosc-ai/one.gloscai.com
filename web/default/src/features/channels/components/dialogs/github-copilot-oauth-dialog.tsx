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
import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { tryPrettyJson } from '@/lib/utils'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  completeGitHubCopilotOAuth,
  startGitHubCopilotOAuth,
} from '../../api'

type GitHubCopilotOAuthDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onKeyGenerated: (key: string) => void
}

export function GitHubCopilotOAuthDialog({
  open,
  onOpenChange,
  onKeyGenerated,
}: GitHubCopilotOAuthDialogProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })

  const [state, setState] = useState({
    verificationUrl: '',
    userCode: '',
    isStarting: false,
    isCompleting: false,
  })

  useEffect(() => {
    if (!open) {
      setState({
        verificationUrl: '',
        userCode: '',
        isStarting: false,
        isCompleting: false,
      })
    }
  }, [open])

  const canCopyUserCode = Boolean(state.userCode && !state.isStarting)
  const canCopyAuthorizeUrl = Boolean(state.verificationUrl && !state.isStarting)
  const canComplete = useMemo(
    () => Boolean(state.userCode) && !state.isCompleting,
    [state.userCode, state.isCompleting]
  )

  const handleStart = async () => {
    setState((prev) => ({ ...prev, isStarting: true }))
    try {
      const res = await startGitHubCopilotOAuth()
      if (!res.success) {
        throw new Error(res.message || 'Failed to start OAuth')
      }

      const verificationUrl =
        res.data?.verification_url || res.data?.authorize_url || ''
      const userCode = res.data?.user_code || ''
      if (!verificationUrl || !userCode) {
        throw new Error('Missing device authorization fields in response')
      }

      setState((prev) => ({ ...prev, verificationUrl, userCode }))
      try {
        window.open(verificationUrl, '_blank', 'noopener,noreferrer')
        toast.success(t('Opened authorization page'))
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Failed to open authorization page:', error)
        toast.warning(t('Please manually copy and open the authorization link'))
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('OAuth start failed')
      )
    } finally {
      setState((prev) => ({ ...prev, isStarting: false }))
    }
  }

  const handleComplete = async () => {
    if (!state.userCode) return
    setState((prev) => ({ ...prev, isCompleting: true }))
    try {
      const res = await completeGitHubCopilotOAuth()
      if (!res.success) {
        throw new Error(res.message || 'OAuth failed')
      }

      const rawKey = res.data?.key || ''
      if (!rawKey) {
        throw new Error('Missing key in response')
      }

      onKeyGenerated(tryPrettyJson(rawKey))
      toast.success(t('Credential generated'))
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('OAuth failed'))
    } finally {
      setState((prev) => ({ ...prev, isCompleting: false }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('GitHub Copilot Authorization')}</DialogTitle>
          <DialogDescription>
            {t(
              'Generate a GitHub OAuth token for Copilot and paste it into the channel key field.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <Alert>
            <AlertDescription>
              {t(
                '1) Click "Open authorization page". 2) Enter the device code shown below and complete GitHub login. 3) Return here and click "Generate credential".'
              )}
            </AlertDescription>
          </Alert>

          <div className='flex flex-wrap gap-2'>
            <Button onClick={handleStart} disabled={state.isStarting}>
              {state.isStarting ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <ExternalLink className='mr-2 h-4 w-4' />
              )}
              {t('Open authorization page')}
            </Button>

            <Button
              type='button'
              variant='outline'
              disabled={!canCopyAuthorizeUrl}
              onClick={async () => {
                if (!state.verificationUrl) return
                await copyToClipboard(state.verificationUrl)
              }}
              aria-label={t('Copy authorization link')}
              title={t('Copy authorization link')}
            >
              {copiedText === state.verificationUrl ? (
                <Check className='mr-2 h-4 w-4 text-green-600' />
              ) : (
                <Copy className='mr-2 h-4 w-4' />
              )}
              {t('Copy authorization link')}
            </Button>
          </div>

          <div className='space-y-2'>
            <div className='text-sm font-medium'>{t('Device code')}</div>
            <div className='flex flex-col gap-2 sm:flex-row'>
              <Input
                readOnly
                value={state.userCode}
                placeholder={t('Click "Open authorization page" to get a code')}
                className='font-mono text-base'
              />
              <Button
                type='button'
                variant='outline'
                disabled={!canCopyUserCode}
                onClick={async () => {
                  if (!state.userCode) return
                  await copyToClipboard(state.userCode)
                }}
                aria-label={t('Copy device code')}
                title={t('Copy device code')}
              >
                {copiedText === state.userCode ? (
                  <Check className='mr-2 h-4 w-4 text-green-600' />
                ) : (
                  <Copy className='mr-2 h-4 w-4' />
                )}
                {t('Copy device code')}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={state.isStarting || state.isCompleting}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleComplete} disabled={!canComplete}>
            {state.isCompleting && (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            )}
            {state.isCompleting ? t('Generating...') : t('Generate credential')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}