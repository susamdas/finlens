import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowUp, Bot, ChevronDown, Info, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { BarList } from '@/components/charts/BarList'
import { SeriesLegend, TrendChart } from '@/components/charts/TrendChart'
import { ErrorState, LoadingSkeleton } from '@/components/common/states'
import { chartVar } from '@/design/palette'
import type { FindexRepository } from '@/data/repository'
import { useDataset, useEnsureData } from '@/hooks/useDataset'
import { SUGGESTIONS, type AnalystAnswer, type AnswerChart } from '@/lib/analyst/answer'
import type { ParsedQuestion } from '@/lib/analyst/parse'
import { ruleProvider } from '@/lib/analyst/provider'
import { formatPercent, formatPP } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Turn {
  id: number
  question: string
  parsed: ParsedQuestion
  answer: AnalystAnswer
}

export default function AnalystPage() {
  const { repo, status, error, retry } = useDataset()
  const groups = useEnsureData({ groups: true })
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Intelligence' }, { label: 'AI Analyst' }]}
        title="AI Analyst"
        description="Ask a question in plain language. Every answer is built from Global Findex values, and every number is listed with its source."
      />
      <Card className="flex gap-3 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">How it works.</span> A rule-based analyst
          running in your browser reads the question, finds the places, indicators and years, and
          looks the values up in the dataset. Nothing you type is sent anywhere. It will say so when
          a question is outside the data — and it describes what changed, not why.
        </p>
      </Card>
      {status === 'error' && (
        <ErrorState
          title="The dataset could not be loaded."
          description={error ?? undefined}
          onRetry={() => void retry()}
        />
      )}
      {(!repo || !groups.ready) && status !== 'error' && <LoadingSkeleton variant="chart" />}
      {repo && groups.ready && <Chat repo={repo} />}
    </div>
  )
}

function Chat({ repo }: { repo: FindexRepository }) {
  const [params, setParams] = useSearchParams()
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)
  const initial = useRef(params.get('q'))

  const ask = async (question: string) => {
    const q = question.trim()
    if (!q || busy) return
    setBusy(true)
    const previous = turns.at(-1)?.parsed ?? null
    const { parsed, answer } = await ruleProvider.answer(q, { repo, previous })
    setTurns((t) => [...t, { id: nextId.current++, question: q, parsed, answer }])
    setDraft('')
    setBusy(false)
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.set('q', q)
        return n
      },
      { replace: true },
    )
  }

  // A shared link (?q=…) asks its question once on arrival.
  useEffect(() => {
    const q = initial.current
    initial.current = null
    if (q) void ask(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [turns.length])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void ask(draft)
  }

  return (
    <div className="space-y-5">
      {turns.length === 0 && (
        <Card className="p-5">
          <p className="mb-3 text-sm font-medium">Try one of these</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Chip key={s} onClick={() => void ask(s)}>
                {s}
              </Chip>
            ))}
          </div>
        </Card>
      )}

      <ol className="space-y-5" aria-live="polite" aria-label="Conversation">
        {turns.map((t) => (
          <li key={t.id} className="space-y-3">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {t.question}
              </p>
            </div>
            <AnswerCard turn={t} onAsk={(q) => void ask(q)} repo={repo} />
          </li>
        ))}
      </ol>
      <div ref={endRef} />

      <form
        onSubmit={submit}
        className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex items-center gap-2 rounded-2xl border bg-card p-2 shadow-overlay"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            turns.length
              ? 'Ask a follow-up, e.g. “and Kenya?”'
              : 'Ask about any country, region or indicator…'
          }
          aria-label="Your question"
          className="border-0 shadow-none focus-visible:ring-0"
          maxLength={300}
        />
        {turns.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Clear conversation"
            onClick={() => setTurns([])}
          >
            <Trash2 />
          </Button>
        )}
        <Button type="submit" size="icon-sm" aria-label="Ask" disabled={!draft.trim() || busy}>
          <ArrowUp />
        </Button>
      </form>
    </div>
  )
}

function AnswerCard({
  turn,
  onAsk,
  repo,
}: {
  turn: Turn
  onAsk: (q: string) => void
  repo: FindexRepository
}) {
  const a = turn.answer
  const [open, setOpen] = useState(false)
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"
          aria-hidden
        >
          <Bot className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          {a.understood.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="What I understood">
              {a.understood.map((u) => (
                <Badge key={u} variant="outline" className="font-normal text-muted-foreground">
                  {u}
                </Badge>
              ))}
            </div>
          )}
          {a.text.map((p) => (
            <p key={p} className="text-[15px] leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      </div>

      {a.chart && <AnswerChartView chart={a.chart} repo={repo} />}

      {a.caveats.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-muted/60 p-3 text-[13px] text-muted-foreground">
          {a.caveats.map((c) => (
            <li key={c} className="flex gap-2">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {c}
            </li>
          ))}
        </ul>
      )}

      {a.facts.length > 0 && (
        <div className="rounded-xl border">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            Sources · {a.facts.length} value{a.facts.length === 1 ? '' : 's'} from the Global Findex
            <ChevronDown
              className={cn('size-4 transition-transform', open && 'rotate-180')}
              aria-hidden
            />
          </button>
          {open && (
            <div className="overflow-x-auto border-t">
              <table className="w-full text-[12.5px]">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">Economy / aggregate</th>
                    <th className="px-3 py-1.5 font-medium">Indicator</th>
                    <th className="px-3 py-1.5 font-medium">Group</th>
                    <th className="px-3 py-1.5 font-medium">Year</th>
                    <th className="px-3 py-1.5 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {a.facts.map((f) => (
                    <tr key={f.id} className="border-t">
                      <td className="px-3 py-1.5">{f.entity}</td>
                      <td className="px-3 py-1.5">{f.indicator}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{f.group}</td>
                      <td className="px-3 py-1.5 tabular">{f.wave}</td>
                      <td className="px-3 py-1.5 text-right font-medium tabular">{f.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(a.links.length > 0 || a.followUps.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {a.links.map((l) => (
            <Button key={l.to} asChild size="sm" variant="outline">
              <Link to={l.to}>{l.label}</Link>
            </Button>
          ))}
          {a.followUps.map((f) => (
            <Chip key={f} onClick={() => onAsk(f)}>
              {f}
            </Chip>
          ))}
        </div>
      )}
    </Card>
  )
}

function AnswerChartView({ chart, repo }: { chart: AnswerChart; repo: FindexRepository }) {
  if (chart.kind === 'bars') {
    const pctUnit = chart.unit === '%'
    return (
      <BarList
        ariaLabel="Answer chart"
        {...(pctUnit ? { max: 100 } : {})}
        showBars={pctUnit || chart.items.every((i) => i.value >= 0)}
        items={chart.items.map((i) => ({
          key: i.key,
          label: i.label,
          value: i.value,
          display: pctUnit ? formatPercent(i.value) : formatPP(i.value),
        }))}
      />
    )
  }
  const series = chart.series.map((s, i) => ({
    id: s.id,
    label: s.label,
    color: chartVar(i),
    points: s.points,
  }))
  return (
    <div>
      <TrendChart waves={repo.waves} unit={chart.unit} series={series} height={220} />
      {series.length > 1 && (
        <SeriesLegend items={series.map((s) => ({ label: s.label, color: s.color }))} />
      )}
    </div>
  )
}

function Chip({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border bg-card px-3 py-1.5 text-left text-[13px] outline-none transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {children}
    </button>
  )
}
