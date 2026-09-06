# Fonts — worldwide legal / privacy note (placeholder)

**Status:** Product note for counsel. Not legal advice.

## Problem

Loading Inter and Bebas Neue from `fonts.googleapis.com` / `fonts.gstatic.com` sends each visitor’s IP address to Google. EU/UK privacy authorities have treated that as a transfer that needs a lawful basis. Google Fonts’ licence (SIL OFL for these two families) is separate from the **hosting** privacy issue.

## Chosen solution (implemented)

**Self-host** the same SIL Open Font License families with the game files:

- Inter (`@fontsource/inter`)
- Bebas Neue (`@fontsource/bebas-neue`)

The game CSS no longer requests Google. Font files ship in the GitHub Pages / Capacitor bundle. OFL allows embedding, modification, and redistribution; it does **not** allow selling the fonts as fonts on their own.

## Alternatives considered

| Option | Worldwide fit |
|---|---|
| Keep Google Fonts CSS API | Simple; weak in EU/UK for IP transfer |
| Bunny Fonts / other CDN | Still a third party; similar transfer analysis |
| System UI stack only | Zero licence/CDN risk; loses brand look |
| Self-host OFL files (chosen) | Same look, no Google request, OFL-compliant |

Counsel should still confirm OFL notices in the shipped bundle if the company wants a written licence appendix.
