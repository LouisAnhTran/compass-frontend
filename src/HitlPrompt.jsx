import { useState } from 'react'
import { Check, ChevronDown, CircleHelp, SearchX, Sparkles } from 'lucide-react'

// SPEC §9. Three render rules, keyed off each item's sub_reason:
//
//   no_extraction  -> "Please select" + full dropdown from all_options
//   found_matches  -> shortlist for <extracted>, confirm or browse all
//   no_match       -> "No match for <extracted>" + full dropdown
//
// `display` is always rendered verbatim — the backend composes it per entity
// type (queues carry their id because 16 of them are named "Invoice"), so the
// frontend never builds these strings itself.

const SINGLE = 'confirm_model'

const TITLES = {
  confirm_model: 'Which document model?',
  confirm_queues: 'Which queues?',
  confirm_members: 'Which people?',
}

export default function HitlPrompt({ payload, disabled, onSubmit }) {
  const single = payload.reason === SINGLE
  const [picked, setPicked] = useState({})

  function toggle(itemIdx, option) {
    setPicked(prev => {
      const current = prev[itemIdx] ?? []
      if (single) return { [itemIdx]: [option] }
      const exists = current.some(o => o.id === option.id)
      return {
        ...prev,
        [itemIdx]: exists ? current.filter(o => o.id !== option.id) : [...current, option],
      }
    })
  }

  const chosen = Object.values(picked).flat()

  function submit() {
    const selections = chosen.map(o => ({ id: o.id, name: o.name }))
    // Model resumes with `selection` (one object); queues and members with
    // `selections` (an array, legitimately empty = "no filter on this field").
    onSubmit(single ? { selection: selections[0] } : { selections })
  }

  const ready = single ? chosen.length === 1 : true

  return (
    <div className="border border-dark-border rounded-xl bg-dark-surface overflow-hidden max-w-2xl animate-fade-in">
      <div className="px-4 py-3 border-b border-dark-border">
        <h3 className="text-sm font-semibold tracking-tight">{TITLES[payload.reason] ?? 'Confirm'}</h3>
      </div>

      <div className="px-4 py-3 flex flex-col gap-4">
        {payload.items.map((item, i) => (
          <Item key={i} item={item} allOptions={payload.all_options}
                selected={picked[i] ?? []} onToggle={opt => toggle(i, opt)} />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-dark-border bg-dark-bg/40">
        <span className="text-[11px] text-dark-muted">
          {single
            ? (chosen.length ? `Selected: ${chosen[0].name}` : 'Select one to continue')
            : (chosen.length
                ? `${chosen.length} selected`
                : 'Selecting nothing means no filter on this field')}
        </span>
        <button disabled={disabled || !ready} onClick={submit}
                className="flex items-center gap-1.5 bg-dark-accent hover:bg-dark-accent-hover text-white
                           text-xs font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-40">
          <Check size={13} /> Confirm
        </button>
      </div>
    </div>
  )
}

function Item({ item, allOptions, selected, onToggle }) {
  const hasShortlist = item.sub_reason === 'found_matches'
  const [browsing, setBrowsing] = useState(!hasShortlist)
  const [filter, setFilter] = useState('')

  const isSelected = opt => selected.some(o => o.id === opt.id)
  const visible = filter
    ? allOptions.filter(o => o.display.toLowerCase().includes(filter.toLowerCase()))
    : allOptions

  return (
    <div className="flex flex-col gap-2">
      <Prompt item={item} />

      {hasShortlist && !browsing && (
        <>
          <ul className="flex flex-col gap-1">
            {item.matches.map(m => (
              <Option key={m.id} option={m} selected={isSelected(m)}
                      onClick={() => onToggle(m)} score={m.score} />
            ))}
          </ul>

          {item.total_above_threshold > item.matches.length && (
            <p className="text-[11px] text-dark-muted">
              Showing {item.matches.length} of {item.total_above_threshold} matches.
            </p>
          )}

          <button onClick={() => setBrowsing(true)}
                  className="self-start flex items-center gap-1 text-[11px] text-dark-muted
                             hover:text-dark-text transition-colors">
            <ChevronDown size={12} /> Browse all {allOptions.length}
          </button>
        </>
      )}

      {browsing && (
        <>
          <input value={filter} onChange={e => setFilter(e.target.value)}
                 placeholder={`Filter ${allOptions.length} options…`}
                 className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-xs
                            focus:outline-none focus:ring-2 focus:ring-dark-accent/30
                            focus:border-dark-accent transition-shadow placeholder:text-dark-muted/60" />
          <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
            {visible.slice(0, 200).map(o => (
              <Option key={o.id} option={o} selected={isSelected(o)} onClick={() => onToggle(o)} />
            ))}
            {!visible.length && (
              <li className="text-[11px] text-dark-muted px-1 py-2">No options match “{filter}”.</li>
            )}
          </ul>
          {/* The queue list is ~1785 long; rendering it all janks the scroll. */}
          {visible.length > 200 && (
            <p className="text-[11px] text-dark-muted">
              Showing first 200 of {visible.length} — keep typing to narrow.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function Option({ option, selected, onClick, score }) {
  return (
    <li onClick={onClick}
        className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border cursor-pointer
                    transition-colors text-xs
                    ${selected
                      ? 'border-dark-accent bg-dark-accent/10 font-medium'
                      : 'border-dark-border hover:bg-dark-bg'}`}>
      <span className="truncate">{option.display}</span>
      <span className="flex items-center gap-2 flex-shrink-0">
        {score != null && (
          <span className="text-[10px] text-dark-muted tabular-nums">{Math.round(score * 100)}%</span>
        )}
        {selected && <Check size={13} className="text-dark-accent" />}
      </span>
    </li>
  )
}

function Prompt({ item }) {
  const map = {
    no_extraction: [CircleHelp, 'Please select.'],
    no_match: [SearchX, <>No match for <Q>{item.extracted}</Q> — select from the list.</>],
    found_matches: [Sparkles, <>We found these for <Q>{item.extracted}</Q>.</>],
  }
  const [Icon, text] = map[item.sub_reason] ?? map.no_extraction
  return (
    <p className="flex items-center gap-1.5 text-xs text-dark-muted">
      <Icon size={13} className="flex-shrink-0" /> {text}
    </p>
  )
}

const Q = ({ children }) => <span className="text-dark-text font-medium">“{children}”</span>
