-- Universal premium: the /journey PWA is available to everyone; the "free"
-- text-only track is retired. New signups default to premium, and every
-- existing participant is upgraded.

alter table users alter column access_tier set default 'premium';

update users
  set access_tier = 'premium',
      premium_granted_at = coalesce(premium_granted_at, now())
  where access_tier <> 'premium';

comment on column users.access_tier is
  'Retained for future tiering, but effectively universal: defaults to premium and everyone has /journey access. (The free text-only track was retired.)';
