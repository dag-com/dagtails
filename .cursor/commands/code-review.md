Review the relevant code with a code review mindset. Prioritize bugs, behavioral regressions, security issues, and missing tests. Findings must be the primary focus, ordered by severity. Do not make code changes unless the user explicitly asks for them.

Scope the review to the outgoing change set when one exists (uncommitted work that will be published, plus commits not yet on `origin`). If there is no outgoing diff, say so in one sentence instead of reviewing unrelated files.
