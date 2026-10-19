<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application architecture
- Keep TanStack file routes and the existing device store; uploaded source must be adapted rather than replacing live Bluetooth or Cloud boundaries.
- Use the global semantic theme and shared Button for feature controls so safety states and touch targets remain consistent.
- Keep multilingual matching local and phrase-backed; unsupported input remains unchanged and medical guidance language is explicitly shown.
- Validate persisted device-local settings with the shared schema and write only when settings change to avoid high-frequency storage work.
- Decode standard Bluetooth packets strictly and reject absent or malformed values rather than supplying defaults.
