# Threadline Examples

## Resume last work session

**User:** I just opened my terminal, what was I working on?

**Assistant (using Threadline):**
1. Calls `resume_last_thread()`
2. Shows the resume card with title, recent activity, open commitments, and artifacts

```
## fix oauth callback in api repo
State: active | Last active: 2h ago

> 8 events; repos: api; includes git commits; ~2h session

Recent activity:
- committed: fix: validate redirect URI
- modified: src/auth.ts

Open commitments:
- [ ] Add integration test for callback handler

Key artifacts:
- /projects/api/src/auth.ts (file)
- https://oauth.net/2/ (url)
```

---

## Show all recent threads

**User:** Show me what threads I have

**Assistant:**
1. Calls `list_recent_threads(limit=10)`
2. Shows formatted list

---

## Explain a file

**User:** Why do I have that Stripe docs tab open?

**Assistant:**
1. Calls `explain_why_open(url="https://stripe.com/docs/api/payment_intents")`
2. Shows which thread it belongs to and when it was last accessed

---

## Find buried commitments

**User:** What did I promise to do this week?

**Assistant:**
1. Calls `find_commitments(status="open")`
2. Groups by thread and shows with due dates

---

## Safe cleanup

**User:** My downloads folder is a mess

**Assistant:**
1. Calls `safe_clean_downloads(dryRun=true)` — shows preview
2. Asks for confirmation
3. If confirmed, calls `safe_clean_downloads(dryRun=false)`
4. Reports files moved and undo token

---

## Prepare handoff

**User:** I need to hand off this project to a colleague

**Assistant:**
1. Calls `list_recent_threads()` to find relevant thread
2. Calls `prepare_handoff(threadId="...")`
3. Formats and presents the handoff document

---

## Capture a checkpoint

**User:** Save where I am, I'm about to take a break

**Assistant:**
1. Prompts for a title if not given
2. Calls `capture_checkpoint(title="...", note="...")`
3. Reports checkpoint saved and any commitments extracted
