# Transcript Racer

**Turn any lecture transcript into a TypeRacer-style game that makes you remember it, not just read it.**

**Live demo:** https://scereweir61.github.io/transcript-racer/ *(goes live once GitHub Pages is switched on, see [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md#phase-11-ship-it))*

> **Screenshot / GIF goes here.** Record a short race, save it as `docs/screenshot.gif`, and replace this line with `![Transcript Racer in action](docs/screenshot.gif)`.

## Features

- **Paste anything:** YouTube captions, `.srt`/`.vtt` text or plain notes. The app strips timestamps, `[Music]`-style tags, filler words (optional) and characters you can't type, like curly quotes and em dashes.
- **Bite-sized sections:** the text is split into sentences and grouped into sections of 1–6 sentences, with a live preview.
- **Three study modes:**
  - **Copy:** type the passage with live green/red feedback per letter.
  - **Fill the blanks:** key terms (like *glycolysis* or *ATP*) are hidden and you type them from memory. Tab reveals a word, but that counts as missed.
  - **Recall:** read the section, it disappears, then type what you remember. You're scored on the words you got right, in the right order.
- **Live stats:** WPM, accuracy, time and a streak counter, plus a car that races to the chequered flag as you type.
- **Results:** a grade stamp (S to D) for every section, personal bests per mode, confetti for great runs, and a session summary that flags weak sections.
- **Drill my weakest bits:** re-run only the sections you found hardest.
- **Remembers you:** your transcript, mode and personal bests are saved in the browser.
- **Works everywhere:** light and dark themes, phone-sized screens, keyboard-friendly, and it respects "reduce motion".

## How it works

1. **Cleaning:** a series of regular expressions removes timestamps (`0:03`, `1:02:45`), bracketed tags, sound cues like `(laughter)` and filler words. It also swaps curly quotes, dashes, `…` and non-breaking spaces for plain keyboard characters, so every character can be typed.
2. **Sectioning:** the text is split wherever a space follows `.`, `!` or `?` (so `3.5` stays together). Auto-captions often have no punctuation at all, so any "sentence" over 260 characters is chopped into roughly 200-character pieces between words. Sentences are then grouped into sections.
3. **Scoring:**
   - **WPM** is (correct characters ÷ 5) ÷ minutes, timed from your first keystroke.
   - **Accuracy** counts every new keystroke, so a fixed mistake still counts as a mistake.
   - **Session WPM** is total characters ÷ total time, not an average of averages.
   - **Fill the blanks** picks words with a weighted random choice: long words and terms like `FADH2` are likely to be hidden, but every retry is different. You score the share of blanks typed correctly first time.
4. **Recall scoring (LCS):** your answer is compared with the original using the **longest common subsequence** of words, worked out with a dynamic-programming table. It finds the longest run of words you typed in the original order, ignoring capitals and punctuation. Word salad scores low, and a missed or extra word only costs a little.

There's a beginner-friendly walkthrough of every function in [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md).

## Tech used

- **HTML, CSS and vanilla JavaScript:** no frameworks, no build step, and just three source files.
- **CSS:** custom properties (variables) for theming, `prefers-color-scheme` for dark mode, `prefers-reduced-motion`, Grid/Flexbox, `:has()`, and `@keyframes` animations.
- **JavaScript:** DOM APIs, regular expressions, `performance.now()` timing, `setInterval`/`setTimeout`, `localStorage` (wrapped in `try/catch`), the Canvas API with `requestAnimationFrame` for confetti, and a dynamic-programming LCS algorithm.
- **Fonts:** Bricolage Grotesque, Nunito and JetBrains Mono from Google Fonts.
- **Hosting:** GitHub Pages.

## Challenges and how I solved them

- **Unpunctuated captions.** Auto-generated YouTube captions often have no full stops, so the whole lecture came out as one giant "sentence". I added a fallback that chops anything over 260 characters into ~200-character pieces, always breaking between words.
- **Un-typeable characters.** Transcripts are full of curly quotes (`’`), em dashes (`—`), ellipses (`…`) and non-breaking spaces that look normal but can't be typed on a standard keyboard, so a section could never be finished. The cleaner swaps each one for its keyboard equivalent before sectioning.
- **Fair WPM.** Averaging each section's WPM lets a 10-second section count as much as a 3-minute one. The session summary adds up all characters and all time instead. The timer starts on the first keystroke (not when the text appears), and WPM shows 0 for the first 1.5 seconds so two quick letters don't show as 200 WPM.
- **Recall scoring.** Checking "how many of the original words appear somewhere in my answer" gave full marks to jumbled word salad. Using the longest common subsequence rewards getting the words *and* their order right, while still forgiving the odd missing or extra word.

## Known limitations

- **Spoken times disappear:** "the meeting is at 9:30" loses the `9:30`, because it looks exactly like a caption timestamp.
- **Abbreviations split sentences:** "Dr. Smith" is split after "Dr." because the splitter sees a full stop followed by a space.
- **Recall is word-for-word:** "we're" and "we are", or "thirty-two" and "thirty two", count as different words.
- **Everything is saved per browser:** transcripts and personal bests live in `localStorage`, so they don't follow you to another device, and a private window starts fresh.

## What's next

- **AI study sets (optional):** turn a transcript into key points, Q&A pairs or key terms with an AI model behind a small serverless function, keeping the API key on the server.
- Upload `.srt`/`.vtt` files directly instead of pasting.
- Keep a history of sessions so you can see your progress on a transcript over time.

## Progress

- [x] Screens: setup, play and done, switched with `show()`
- [x] Cleaning: removes timestamps, `[Music]`-style tags, filler words (optional) and hard-to-type characters
- [x] Sections: splits the cleaned text into sentences and groups them into sections
- [x] Typing game: per-letter colouring, blinking caret, paste blocked, restart and skip
- [x] WPM and accuracy: live stats strip, result panel with Next / Try again / End session
- [x] Session summary and saving: results table, weak pills, weakest-sections drill, transcript saved in localStorage, sample transcript
- [x] Fill-the-blanks mode: mode picker, weighted-random blanks, Tab to reveal, blanks-recalled score
- [x] Recall mode: read, it hides, type from memory; scored with longest common subsequence
- [x] Make it look good: notebook look, light/dark themes, car and flag, streaks, grade stamps, confetti, personal bests
- [x] Ship it: relative paths, GitHub Pages instructions, this README

## Run it locally

Open the folder in VS Code and start **Live Server** on `index.html`, or just double-click `index.html`. There's nothing to install.
