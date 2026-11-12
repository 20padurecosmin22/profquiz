# ProfQuiz

Platformă gratuită de teste interactive pentru instituțiile de învățământ din Republica Moldova.
Profesorii creează teste cu imagini și șase tipuri de întrebări, le joacă live la clasă (tabla + telefoanele elevilor)
și urmăresc rezultatele în rapoarte cu export Excel. Elevii intră doar cu PIN-ul, fără cont.

## Funcții

- Conturi de profesor (email și parolă, prin Supabase Auth)
- Editor de teste: alegere unică, alegere multiplă, adevărat/fals, răspuns scris, ordonare, sondaj;
  imagine, timp (5–240 s) și punctaj (standard, dublu, fără) pentru fiecare întrebare; salvare automată
- Import din Excel/CSV (șablon ProfQuiz sau formatul șablonului Kahoot)
- Joc live: PIN + cod QR, punctaj după viteză, serii de răspunsuri corecte, clasament, podium,
  eliminarea numelor nepotrivite, revenirea elevului în joc după reîncărcarea paginii
- Rapoarte: rezumat, întrebările dificile, elevii sub 50%, rezultate pe elev și pe întrebare, export .xlsx
- Biblioteca publică: căutare, filtre pe disciplină și nivel, previzualizare, joc direct sau copiere în cont

## Tehnologii

Next.js 16 (App Router, Server Actions), Supabase (Postgres cu RLS, Auth, Storage, Realtime broadcast), Vercel.
Stilul vizual urmează `TJA_design_system.json` (navy, violet #8057F4, motiv geometric, Inter).

## Structura

- `app/` paginile: `/` prezentare, `/joc` elevul, `/live/[id]` tabla, `/panou` profesorul, `/biblioteca`
- `lib/questions.js` tipurile de întrebări, verificarea și notarea răspunsurilor
- `lib/room.js` canalele Realtime dintre tablă și telefoane
- `lib/excel.js` șablonul, importul și exportul Excel
- `app/actions/` operațiile de server (conturi, teste, jocuri)
- `proxy.js` reîmprospătarea sesiunii și protejarea paginilor profesorului

## Securitate

- Cheile Supabase stau doar în variabilele de mediu ale serverului (Vercel), fără prefixul `NEXT_PUBLIC_`, deci nu ajung în codul trimis browserului.
- Conturile, testele, imaginile, rapoartele și biblioteca trec prin Server Actions și rute de server; browserul nu comunică direct cu baza de date.
- Cookie-urile de sesiune sunt `httpOnly`, `secure` și `sameSite=lax`.
- Imaginile sunt într-un bucket privat și se servesc prin `/media/...` de pe domeniul aplicației.
- Doar paginile jocului live (`/live`, `/joc`) primesc de la server configurația pentru Supabase Realtime, necesară legăturii instantanee tablă-telefoane.
- Toate tabelele au RLS; datele primite de server sunt validate înainte de scriere.

## Variabile de mediu (Vercel)

```
SUPABASE_URL=https://<proiect>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Rulare locală

```
npm install
npm run dev
```

## Baza de date

Tabele: `profiles`, `quizzes`, `questions`, `game_sessions`, `session_players`, `session_answers`;
funcții `session_by_pin` (verificarea PIN-ului de pe telefon) și `copy_quiz` (copierea din bibliotecă);
bucketul privat `quiz-images`. Toate tabelele au RLS: profesorul vede doar datele proprii și testele publice.
Rezultatele jocului sunt scrise prin server, în numele profesorului autentificat, nu de telefoanele elevilor.

## Setări Supabase recomandate

- Authentication → URL Configuration: Site URL = adresa de pe Vercel; adăugați `https://<domeniu>/auth/callback` la Redirect URLs.
- Authentication → Emails: serviciul de email implicit Supabase trimite doar către membrii echipei proiectului.
  Pentru profesori reali configurați un SMTP propriu (de ex. Resend) sau dezactivați temporar „Confirm email”.
