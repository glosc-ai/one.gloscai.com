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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AnimateInView } from '@/components/animate-in-view'
import { useLiveHomeModels } from '../../hooks'

export function Models() {
  const { t } = useTranslation()
  const { models, totalCount, isLoading } = useLiveHomeModels(8)

  return (
    <section className='relative z-10 px-6 pb-8 md:pb-12'>
      <div className='mx-auto max-w-6xl'>
        <div className='mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end'>
          <div>
            <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
              {t('Model coverage')}
            </p>
            <h2 className='text-3xl leading-tight font-bold tracking-normal md:text-4xl'>
              {t('Covered global mainstream models')}
            </h2>
          </div>
          <Button variant='outline' render={<Link to='/pricing' />}>
            {totalCount > 0
              ? `${t('View all currently available models')} · ${totalCount}`
              : t('View all 200+ models')}
          </Button>
        </div>

        <AnimateInView>
          <div className='border-border overflow-hidden border-y'>
            <Table>
              <TableHeader>
                <TableRow className='hover:bg-transparent'>
                  <TableHead className='text-muted-foreground px-4 text-xs font-semibold tracking-[0.08em] uppercase'>
                    {t('Provider')}
                  </TableHead>
                  <TableHead className='text-muted-foreground px-4 text-xs font-semibold tracking-[0.08em] uppercase'>
                    {t('Model')}
                  </TableHead>
                  <TableHead className='text-muted-foreground px-4 text-xs font-semibold tracking-[0.08em] uppercase'>
                    {t('Context')}
                  </TableHead>
                  <TableHead className='text-muted-foreground px-4 text-xs font-semibold tracking-[0.08em] uppercase'>
                    {t('Type')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && models.length === 0 ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={`model-skeleton-${index}`}>
                      <TableCell className='px-4'>
                        <Skeleton className='h-5 w-24' />
                      </TableCell>
                      <TableCell className='px-4'>
                        <Skeleton className='h-5 w-40' />
                      </TableCell>
                      <TableCell className='px-4'>
                        <Skeleton className='h-5 w-16' />
                      </TableCell>
                      <TableCell className='px-4'>
                        <Skeleton className='h-6 w-24 rounded-full' />
                      </TableCell>
                    </TableRow>
                  ))
                ) : models.length > 0 ? (
                  models.map((model) => (
                    <TableRow key={`${model.provider}-${model.name}`}>
                      <TableCell className='text-muted-foreground px-4'>
                        {model.provider === 'Unknown'
                          ? t('Unknown')
                          : model.provider}
                      </TableCell>
                      <TableCell className='px-4 font-semibold'>
                        {model.name}
                      </TableCell>
                      <TableCell className='text-muted-foreground px-4 font-mono'>
                        {model.context}
                      </TableCell>
                      <TableCell className='px-4'>
                        <Badge
                          variant='outline'
                          className={
                            model.accent
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'text-muted-foreground'
                          }
                        >
                          {t(model.type)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className='text-muted-foreground h-28 text-center text-sm'
                    >
                      {t('No models available')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
