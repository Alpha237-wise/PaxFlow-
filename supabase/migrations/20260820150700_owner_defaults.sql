-- Defaults owner columns to the calling user so the client never has to
-- remember to set them (and can't set them to someone else's id anyway,
-- since the RLS with-check on these columns still applies).
alter table public.crossings alter column created_by set default auth.uid();
alter table public.known_people alter column owner_id set default auth.uid();
alter table public.known_crew alter column owner_id set default auth.uid();
