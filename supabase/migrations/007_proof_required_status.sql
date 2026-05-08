-- Add proof_required to check_results status constraint (scoped for future proof-upload flow)
alter table check_results
  drop constraint check_results_status_values;

alter table check_results
  add constraint check_results_status_values
  check (status in (
    'pending', 'clear', 'hit', 'unavailable', 'timeout', 'partial', 'error',
    'requires_user_action', 'proof_required'
  ));
