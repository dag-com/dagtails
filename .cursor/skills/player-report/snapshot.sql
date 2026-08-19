-- Single-row JSON snapshot for the player-report skill.
-- Excludes ops probes and Playwright (automation=true). QA volume days are
-- still present historically; the skill flags them in copy.
with play as (
  select
    e.*,
    (e.created_at at time zone 'utc')::date as day,
    coalesce(
      nullif(e.props->>'device_id', ''),
      e.player_id::text,
      e.props->>'session',
      'unknown'
    ) as ident
  from public.events e
  where e.name not in ('ops_healthcheck', 'backend_health')
    and coalesce(e.props->>'automation', 'false') not in ('true', 't', '1')
),
daily as (
  select
    day,
    count(*) filter (where name = 'app_open')::int as opens,
    count(*) filter (where name = 'stage_started')::int as started,
    count(*) filter (where name = 'stage_result')::int as served,
    count(*) filter (where name = 'drink_abandoned')::int as abandoned,
    count(*) filter (where name = 'mixologist_started')::int as mix_start,
    count(*) filter (where name = 'session_start')::int as sessions
  from play
  group by 1
)
select jsonb_build_object(
  'pulled_at', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'range_start', (select min(day)::text from play),
  'range_end', (select max(day)::text from play),
  'phase1_live', exists (
    select 1 from play
    where nullif(props->>'device_id', '') is not null
  ),
  'totals', jsonb_build_object(
    'events', (select count(*)::int from play),
    'opens', (select count(*)::int from play where name = 'app_open'),
    'sessions', (select count(*)::int from play where name = 'session_start'),
    'identities', (select count(distinct ident)::int from play),
    'devices', (
      select count(distinct props->>'device_id')::int from play
      where nullif(props->>'device_id', '') is not null
    ),
    'signed_in_players', (
      select count(distinct player_id)::int from play where player_id is not null
    ),
    'started', (select count(*)::int from play where name = 'stage_started'),
    'served', (select count(*)::int from play where name = 'stage_result'),
    'abandoned', (select count(*)::int from play where name = 'drink_abandoned'),
    'profiles', (select count(*)::int from play where name = 'profile_created'),
    'intro_skip', (select count(*)::int from play where name = 'intro_skip'),
    'intro_complete', (select count(*)::int from play where name = 'intro_complete'),
    'intro_start', (select count(*)::int from play where name = 'intro_start'),
    'menu_return', (select count(*)::int from play where name = 'menu_return')
  ),
  'intro', jsonb_build_object(
    'started', (select count(*)::int from play where name = 'intro_start'),
    'skipped', (select count(*)::int from play where name = 'intro_skip'),
    'finished', (select count(*)::int from play where name = 'intro_complete'),
    'people_started', (select count(distinct ident)::int from play where name = 'intro_start'),
    'people_skipped', (select count(distinct ident)::int from play where name = 'intro_skip'),
    'people_finished', (select count(distinct ident)::int from play where name = 'intro_complete'),
    'first_run_started', (
      select count(*)::int from play
      where name = 'intro_start'
        and coalesce(nullif(props->>'source', ''), 'first_run') = 'first_run'
    ),
    'first_run_skipped', (
      select count(*)::int from play
      where name = 'intro_skip'
        and coalesce(nullif(props->>'source', ''), 'first_run') = 'first_run'
    ),
    'first_run_finished', (
      select count(*)::int from play
      where name = 'intro_complete'
        and coalesce(nullif(props->>'source', ''), 'first_run') = 'first_run'
    )
  ),
  'daily', coalesce((
    select jsonb_agg(jsonb_build_object(
      'day', day::text,
      'opens', opens,
      'started', started,
      'served', served,
      'abandoned', abandoned,
      'mix_start', mix_start,
      'sessions', sessions,
      'likely_qa', opens >= 80
    ) order by day)
    from daily
  ), '[]'::jsonb),
  'funnel', coalesce((
    select jsonb_agg(jsonb_build_object(
      'step', name,
      'events', n,
      'people', people
    ) order by n desc)
    from (
      select name,
        count(*)::int as n,
        count(distinct ident)::int as people
      from play
      where name in (
        'app_open', 'session_start', 'splash_continue', 'profile_created',
        'intro_complete', 'intro_skip', 'intro_start', 'hub_view', 'hub_cta', 'map_view',
        'stage_started', 'stage_result', 'drink_abandoned', 'menu_return'
      )
      group by name
    ) s
  ), '[]'::jsonb),
  'stars', coalesce((
    select jsonb_agg(jsonb_build_object(
      'stars', stars,
      'n', n
    ) order by stars)
    from (
      select coalesce(props->>'stars', 'none') as stars,
        count(*)::int as n
      from play
      where name = 'stage_result'
      group by 1
    ) s
  ), '[]'::jsonb),
  'venues', coalesce((
    select jsonb_agg(jsonb_build_object(
      'venue', venue,
      'started', started
    ) order by started desc)
    from (
      select coalesce(props->>'venue_id', props->>'venue', 'unknown') as venue,
        count(*)::int as started
      from play
      where name = 'stage_started'
      group by 1
    ) s
  ), '[]'::jsonb),
  'recipes', coalesce((
    select jsonb_agg(jsonb_build_object(
      'recipe', recipe,
      'complexity', complexity,
      'started', started
    ) order by started desc)
    from (
      select
        coalesce(props->>'recipe', props->>'recipe_id', 'unknown') as recipe,
        coalesce(props->>'complexity', 'unknown') as complexity,
        count(*)::int as started
      from play
      where name = 'stage_started'
      group by 1, 2
      order by 3 desc
      limit 12
    ) s
  ), '[]'::jsonb),
  'modes', coalesce((
    select jsonb_agg(jsonb_build_object(
      'mode', mode,
      'served', served
    ) order by served desc)
    from (
      select coalesce(props->>'mode', 'unknown') as mode,
        count(*)::int as served
      from play
      where name = 'stage_result'
      group by 1
    ) s
  ), '[]'::jsonb),
  'hub_cta', coalesce((
    select jsonb_agg(jsonb_build_object(
      'cta', cta,
      'n', n
    ) order by n desc)
    from (
      select coalesce(props->>'cta', 'unknown') as cta,
        count(*)::int as n
      from play
      where name = 'hub_cta'
      group by 1
    ) s
  ), '[]'::jsonb),
  'abandon_steps', coalesce((
    select jsonb_agg(jsonb_build_object(
      'last_step', last_step,
      'n', n
    ) order by n desc)
    from (
      select coalesce(props->>'last_step', 'unknown') as last_step,
        count(*)::int as n
      from play
      where name = 'drink_abandoned'
      group by 1
    ) s
  ), '[]'::jsonb),
  'left_drink', jsonb_build_object(
    'n', (select count(*)::int from play where name = 'drink_abandoned'),
    'people', (select count(distinct ident)::int from play where name = 'drink_abandoned'),
    'started', (select count(*)::int from play where name = 'stage_started'),
    'people_started', (select count(distinct ident)::int from play where name = 'stage_started'),
    'by_step', coalesce((
      select jsonb_agg(jsonb_build_object(
        'last_step', last_step,
        'n', n
      ) order by n desc)
      from (
        select coalesce(nullif(props->>'last_step', ''), 'unknown') as last_step,
          count(*)::int as n
        from play
        where name = 'drink_abandoned'
        group by 1
      ) s
    ), '[]'::jsonb),
    'by_reason', coalesce((
      select jsonb_agg(jsonb_build_object(
        'reason', reason,
        'n', n
      ) order by n desc)
      from (
        select coalesce(nullif(props->>'reason', ''), 'unknown') as reason,
          count(*)::int as n
        from play
        where name = 'drink_abandoned'
        group by 1
      ) s
    ), '[]'::jsonb)
  ),
  'menu_return', jsonb_build_object(
    'n', (select count(*)::int from play where name = 'menu_return'),
    'people', (select count(distinct ident)::int from play where name = 'menu_return'),
    'by_from', coalesce((
      select jsonb_agg(jsonb_build_object(
        'from', origin,
        'n', n,
        'people', people
      ) order by n desc)
      from (
        select coalesce(nullif(props->>'from', ''), 'unknown') as origin,
          count(*)::int as n,
          count(distinct ident)::int as people
        from play
        where name = 'menu_return'
        group by 1
      ) s
    ), '[]'::jsonb)
  ),
  'mixologist', jsonb_build_object(
    'started', (select count(*)::int from play where name = 'mixologist_started'),
    'finished', (select count(*)::int from play where name = 'mixologist_result'),
    'verdicts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'verdict', verdict,
        'n', n,
        'avg_score', avg_score
      ) order by n desc)
      from (
        select
          coalesce(props->>'verdict', 'unknown') as verdict,
          count(*)::int as n,
          round(avg((props->>'score')::numeric), 1) as avg_score
        from play
        where name = 'mixologist_result'
        group by 1
      ) s
    ), '[]'::jsonb)
  ),
  'side_modes', jsonb_build_object(
    'endless_started', (select count(*)::int from play where name = 'endless_started'),
    'endless_over', (select count(*)::int from play where name = 'endless_over'),
    'training_started', (select count(*)::int from play where name = 'training_started'),
    'training_complete', (select count(*)::int from play where name = 'training_complete'),
    'cotd_started', (select count(*)::int from play where name = 'cotd_started'),
    'shop_open', (select count(*)::int from play where name = 'shop_open'),
    'community_share', (select count(*)::int from play where name = 'community_share')
  ),
  'platforms', coalesce((
    select jsonb_agg(jsonb_build_object(
      'platform', platform,
      'opens', n
    ) order by n desc)
    from (
      select coalesce(props->>'platform', 'unknown') as platform,
        count(*)::int as n
      from play
      where name = 'app_open'
      group by 1
    ) s
  ), '[]'::jsonb),
  'retention', coalesce((
    select jsonb_agg(jsonb_build_object(
      'cohort_day', cohort_day::text,
      'd0', d0,
      'd1', d1,
      'd7', d7
    ) order by cohort_day desc)
    from (
      select * from public.analytics_retention limit 14
    ) r
  ), '[]'::jsonb)
) as report;
