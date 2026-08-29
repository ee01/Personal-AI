-- 066_confirm_request_resume_action.sql
-- Generalize "human approves, work resumes" beyond OpenClaw delegation.
--
-- Until now routes/confirmRequests.ts only resumed an action when
-- category='openclaw_delegation', and it recovered the action id by scanning
-- evidence_refs_json for an 'action:' prefix. Every other kind of human gate
-- the Task Center needs (write approval, dev plan gate, artifact review) would
-- have had to bolt another category onto that same if-branch.
--
-- An explicit column makes the link first-class: whoever creates the confirm
-- request names the action to resume, and the answer handler resumes it
-- regardless of category. The old evidence_refs lookup stays as a fallback so
-- confirm requests created before this migration still resume.
ALTER TABLE confirm_requests ADD COLUMN resume_action_id TEXT;

CREATE INDEX IF NOT EXISTS idx_confirm_requests_resume_action
  ON confirm_requests(resume_action_id)
  WHERE resume_action_id IS NOT NULL;
