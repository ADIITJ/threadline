# Response Templates

## Thread list

```markdown
## Recent Threads

**[{state}]** {title}
  ID: `{id}` | Last active: {relative} | Artifacts: {count} | Commitments: {count}
  > {summary}
```

## Resume card

```markdown
## {title}
**State:** {state} | **Last active:** {relative}

> {summary}

**Recent activity:**
- {kind}: {title}
- ...

**Open commitments:**
- [ ] {commitment text}

**Key artifacts:**
- `{path}` ({type})
```

## Handoff document

```markdown
## Handoff: {title}

**Summary:** {executiveSummary}

### Timeline
- [{time}] {source}/{kind} — {title}

### Open Commitments
- [ ] {commitment}

### Artifacts
- `{locator}` ({type})

### Next Steps
- {step}
```

## Cleanup preview

```markdown
## Downloads Cleanup Preview

{count} files older than {days} days ({totalMB} MB):

| File | Age | Size |
|------|-----|------|
| {filename} | {days}d | {size} |

Run with `dryRun: false` to move to quarantine.
All moves are reversible via `undo_last_cleanup`.
```

## Commitment report

```markdown
## Open Commitments

**{threadTitle}** ({state})
- [ ] {text} _(due {date})_
- [ ] {text}
```
