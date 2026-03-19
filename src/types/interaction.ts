/**
 * Widget interaction events — viewer submissions.
 */

export interface InteractionEvent {
  event_id: string; // evt_<uuid> — client-supplied for idempotency
  widget_id: string;
  action: string;
  payload: Record<string, unknown>;
  submitted_at: string; // ISO 8601 UTC
}
