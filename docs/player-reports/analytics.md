# DAG Tails analytics spec

What we log, why, and what we do not log. This is the tracking spec — not today’s player numbers. Live snapshots: [latest.md](./latest.md).

Public page (no GitHub login): [analytics.html](./site/analytics.html) on Pages as [player-reports/analytics.html](https://dag-com.github.io/last-call-bartending-game/player-reports/analytics.html).

Stage: pre-monetization bartender sim for testers (web, Expo, Capacitor). North star: **first drink served** and **came back the next day**. Shop checkout is a demo — demand, not revenue.

## Keep the current pipe

Events go through `track()` in the game, a local debug log, and write-only `public.events` in Supabase. Do not buy Amplitude or Mixpanel yet. Identity, session, and the first-session funnel come first. Graduate to PostHog when you want UI funnels without SQL, or when daily players pass a couple of hundred.

## North-star pair

- **D0 first-serve** — share of new sessions that finish and serve a drink (the aha moment).
- **D1 return** — share of those people who open the game the next calendar day.

Supporting: time to first serve, started vs served vs left unfinished, 3-star rate by teaching level, mode mix after unlock, which bar loses people.

## Casual-mobile sanity checks

Planning bands, not live DAG Tails traffic. Use them to decide if a number is broken vs normal for this stage.

| Check | Floor (investigate) | Healthy target |
| --- | --- | --- |
| Came back next day | 25% | 40% |
| Came back in a week | 8% | 15% |
| Came back in a month | 3% | 6% |
| Typical session | — | 4–8 minutes |
| First-session complete | — | 70%+ reach a served drink |

Endless and Mixologist unlock after 5 cleared journey drinks. If people leave at 3–4, they never see the long-term loop.

## Predicted leak points

| Leak | Why it matters | Event that proves it |
| --- | --- | --- |
| Profile gate | Name + age before any pour | app_open → profile_created |
| Intro comic | Story before the loop | intro_start / skip / complete |
| Map after first home tap | Highest-friction surface | hub_cta=journey → map_view → stage_started |
| Mid-pour quit | Skill wall on a phone | drink_abandoned vs stage_result |
| Teaching ramp | Guess → Pour → Mix → Garnish → Full bar | stage_result.complexity + stars |
| Unlock at 5 clears | Sandbox modes hide until then | stage_result.stage + mixologist_started |

## First-session funnel

One chain. Conversion is count(step n+1) / count(step n) among the same phone/browser on day 0.

| Step | In the game? | Question it answers |
| --- | --- | --- |
| app_open | Yes | Did the build boot? |
| splash_continue | Yes | Did they leave on the title card? |
| profile_created | Yes | Did the age gate kill the session? |
| intro_complete | Yes | Did the comic stall them? |
| hub_view | Yes | Did they reach the home screen? |
| map_view | Yes | Did Journey actually open the map? |
| stage_started | Yes | Did they enter the station? |
| stage_result | Yes | Did they finish a drink? |

Phase 1 events are in the game. The live report still shows zeros until testers play the current build (that tracking is not in older logs).

## Event catalog — already shipping

Keep these names. Enrich properties; do not rename unless you also dual-write for a week.

| Event | When | Add to props | Used for |
| --- | --- | --- | --- |
| app_open | Boot | platform, build, device_id, viewport | Who opened, who came back |
| profile_modal_open | Create / edit | mode | Gate drop |
| profile_created | Save new profile | underage, units — never name/age | Age-gate split |
| profile_updated | Save edit | underage, units | Settings churn |
| stage_started | Enter station | mode, recipe_id, venue_id, complexity, stage | Loop start |
| stage_result | Serve | duration_ms, stars, pct, pour ok/near/miss, which skill failed | Quality, aha |
| training_started | Hub Learn | — | Mode discovery |
| endless_started | Hub Endless | cleared_at_unlock | After unlock |
| mixologist_started | Hub Mix | cleared_at_unlock | After unlock |
| mixologist_result | Invent + serve | score, verdict, family, classic — not player drink name | Sandbox quality |
| shop_open | Open shop | source_screen, recipe_id | Demand |
| shop_checkout | Demo pay | item_ids, total (intent only) | Would-buy |
| community_share | Share invention | score, family — not display name | Sharing |

## Event catalog — Phase 1 (in the game now)

One event per player intent. Mechanics detail sits on serve / left-unfinished, not on every tap.

| Event | Fire when | Key props | Decision it unlocks |
| --- | --- | --- | --- |
| session_start | New session (or 30 min background) | session_n, returning, streak, cleared | Sessions |
| session_end | Hide / 30 min idle | duration_ms, drinks_served, last_screen | Session length |
| splash_continue | Enter tap on splash | returning | Title drop-off |
| intro_start | Comic opens | source: first_run or settings | Story cost |
| intro_skip | Skip / close early | panel_index | Is the comic a leak? |
| intro_complete | Last panel done | panels | Story finish |
| hub_view | Home becomes active | cleared, unlocked_modes | Home reach |
| hub_cta | Any home button | cta: journey, mix, endless, training, cotd, badges, help, settings, profile | What they tap |
| map_view | Map shown | venue_id, frontier | Map friction |
| map_drink_tap | Path node | recipe_id, venue_id, locked | Replay vs frontier |
| drink_abandoned | Leave station without serve | last_step, reason, duration_ms, mode, recipe_id | Station leak |
| menu_return | Back to the home screen | from, mode | Where they left |
| cotd_started | Cocktail of the Day load | recipe_id, already_done_today | Daily hook |
| training_complete | Training result | stars, duration_ms | Did Learn work? |
| endless_over | 0 lives or quit | served, best_streak, score | Shift length |

## Event catalog — Phase 2 (later)

Add only once Phase 1 answers the north-star questions.

| Event | Why later |
| --- | --- |
| complexity_tier_enter | You can derive this from stage number |
| venue_complete | Confirms which bar is the wall |
| modes_unlocked | Fired once at 5 clears |
| badge_unlock | Too rare to be a north star |
| ticket_flip | Are people reading the recipe? |
| result_cta | Retry vs Next vs Shop vs Quit after judges |
| community_view | Feed opened. Always split by underage |
| community_like | Sharing health |
| leaderboard_view | Vanity vs return |
| shop_add_item | Which catalog rows get tapped |
| boot_ready | First-session length is lying if boot is 8s |
| rotate_lock_shown | Portrait gate |
| client_error | name + message_hash only. Never stack traces with player input |

## Do not log

| Tempting event | Why skip |
| --- | --- |
| Every millilitre of a pour | Radio killer. Fold accuracy into served (ok / near / miss) |
| Every Back / Next step | Left-without-serving.last_step is enough until the station is the proven leak |
| Player name, location, exact age | Analytics only needs underage true/false |
| Mixologist display names | User-typed. Use classic / score / verdict / family |

## How to log

Three IDs on every event: **device_id** (once in local storage — how D1 works for anonymous testers), **session_id** (reset after 30 minutes in background), **player_id** (signed-in uid, optional).

Super-properties attached in `track()`, not by hand: device_id, session_id, platform (web / ios / android), build, underage, units, returning, viewport, pointer (coarse / fine). Split every dashboard by platform and underage.

Age gate is a legal line: log `underage` only. Do not log exact age, date of birth, or the typed name. Community events stay off for under-18 in analytics the same way the button is hidden.

Rules: verb + object, snake_case; one event per intent, details in props; stable ids (`gin_tonic`, `snug`), not display names; server `created_at` is source of truth for retention; never block Serve Drink if analytics is down.

Batch inserts (every 10 events or 10 seconds, and on hide) so a phone radio is not woken per tap. Keep the 300-row local debug log. Do not create a parallel events table.

## Serve payload

One fat `stage_result` row when they tap Serve Drink.

| Prop | Example | Reads as |
| --- | --- | --- |
| mode | campaign, training, cotd, endless, mixologist | Which loop |
| recipe_id / venue_id | tom_collins / snug | Content difficulty |
| complexity | Guess, Pour, Mix, Garnish, Full bar | Ramp health |
| stage | 1–N | Progression |
| duration_ms | 42000 | Friction |
| stars / pct | 2 / 74 | Success |
| glass_ok / method_ok / garnish_ok | true / false / auto | Which skill failed |
| pour_ok / pour_near / pour_miss | 2 / 1 / 0 | Jigger skill, not every ml |
| steps_back | 3 | Indecision at the station |

## What to read

**This week:** open → profile → home → start → serve; median time to first serve by platform; left unfinished by last step; stars by teaching level.

**Once you have 7 days of testers:** D1 by underage, platform, and “served a drink on day 0”; home-button mix; venue drop-off; share of sessions that touch Mixologist / Endless after unlock.

`analytics_daily` only counts event names. It cannot compute who came back. Stop using it as the only dashboard.

## BA recommendation

Instrument the first-session funnel and the serve / leave-unfinished pair, with a durable device_id and a 30-minute session. Read first-serve and next-day return by platform. Use those two numbers to decide whether to fix the profile gate, the map, or the pour station — not all three at once. Leave shop, community, and a third-party SDK until those two numbers are visible every morning.
