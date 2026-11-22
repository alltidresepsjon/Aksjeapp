# Mottak for egne bilder

Legg PNG-bildene dine her, med navnene fra `docs/grafikk-prompter.md`, og kjør:

```bash
npm run art
```

Skriptet fjerner ensfarget bakgrunn, beskjærer, skalerer og legger bildene i
`packages/client/public/assets/graphics/`. Spillet bruker dem automatisk. Det som mangler,
tegnes fortsatt av koden. `npm run art:clear` fjerner alle importerte bilder igjen.

Du kan også laste bildene opp her via GitHub («Add file» → «Upload files») eller sende dem i
chatten, så importerer jeg dem.
