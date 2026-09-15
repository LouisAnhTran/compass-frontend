import { useState } from 'react'

// SPEC §9. Three render rules, keyed off each item's sub_reason:
//
//   no_extraction  -> "Please select" + full dropdown from all_options
//   found_matches  -> shortlist for <extracted>, confirm or browse all
//   no_match       -> "No match for <extracted>" + full dropdown
//
// `display` is always rendered verbatim — the backend composes it per entity
// type (queues carry their id, members are "First Last"), so the frontend never
// builds these strings itself.

const SINGLE = 'confirm_model'   // model is single-select; queues/members are multi

export default function HitlPrompt({ payload, disabled, onSubmit }) {
  const single = payload.reason === SINGLE
  const [picked, setPicked] = useState({})   // itemIndex -> array of options

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

  function submit() {
    const chosen = Object.values(picked).flat().map(o => ({ id: o.id, name: o.name }))
    // Model resumes with `selection` (one object); queues and members resume
    // with `selections` (an array, legitimately empty = "no filter").
    onSubmit(single ? { selection: chosen[0] } : { selections: chosen })
  }

  const ready = single ? Object.values(picked).flat().length === 1 : true

  return (
    <div className="hitl">
      <h3>{titleFor(payload.reason)}</h3>

      {payload.items.map((item, i) => (
        <Item
          key={i}
          item={item}
          allOptions={payload.all_options}
          selected={picked[i] ?? []}
          onToggle={opt => toggle(i, opt)}
        />
      ))}

      <button disabled={disabled || !ready} onClick={submit}>
        {single ? 'Confirm' : 'Confirm selection'}
      </button>
      {!single && (
        <p className="muted">Selecting nothing means no filter on this field.</p>
      )}
    </div>
  )
}

function Item({ item, allOptions, selected, onToggle }) {
  const [browsing, setBrowsing] = useState(item.sub_reason !== 'found_matches')
  const isSelected = opt => selected.some(o => o.id === opt.id)

  return (
    <div className="hitl-item">
      <p className="prompt">{promptFor(item)}</p>

      {item.sub_reason === 'found_matches' && !browsing && (
        <>
          <ul className="options">
            {item.matches.map(m => (
              <li key={m.id}
                  className={isSelected(m) ? 'sel' : ''}
                  onClick={() => onToggle(m)}>
                <span>{m.display}</span>
                <small className="muted">{Math.round(m.score * 100)}%</small>
              </li>
            ))}
          </ul>
          <button className="ghost" onClick={() => setBrowsing(true)}>Browse all…</button>
        </>
      )}

      {browsing && (
        <ul className="options scroll">
          {allOptions.map(o => (
            <li key={o.id}
                className={isSelected(o) ? 'sel' : ''}
                onClick={() => onToggle(o)}>
              {o.display}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function titleFor(reason) {
  return {
    confirm_model: 'Which document model?',
    confirm_queues: 'Which queues?',
    confirm_members: 'Which people?',
  }[reason] ?? 'Confirm'
}

function promptFor(item) {
  switch (item.sub_reason) {
    case 'no_extraction': return 'Please select.'
    case 'no_match':      return `No match for “${item.extracted}” — select from the list.`
    default:              return `We found these for “${item.extracted}” — confirm or browse all.`
  }
}
