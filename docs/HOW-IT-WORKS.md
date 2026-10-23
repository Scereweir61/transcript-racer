# How Transcript Racer works

This file explains the code one phase at a time, in plain English. Phases 1–4 (screens, cleaning and sectioning) are summarised in the README.

## Phase 5: Typing core

### What was added

- **HTML:** the play screen now has `p#sectionLabel` ("Section 2 of 5"), `p#passage` (the text to type), `textarea#typeBox` (where you type), and Restart section / Skip buttons.
- **CSS:** classes for correct (`ok`, green), wrong (`bad`, red) and the caret (`cur`), plus a `[hidden]` rule so hidden things stay hidden.
- **JavaScript:** three new pieces of state and a handful of small functions.

### The state

- `order`: the list of section numbers in this run, e.g. `[0, 1, 2, 3, 4]`.
- `pos`: how far through `order` we are. `order[pos]` is the section being typed.
- `cur`: an object about the current section: its `index`, its `target` text and its `spans` (one per letter).

### The functions

- `startRun(sectionNumbers)` stores the run, resets `pos` to 0, switches to the play screen and loads the first section.
- `startAll()` builds `[0, 1, 2, ...]` for every section and calls `startRun`. The Start button calls this.
- `loadSection()` creates a fresh `cur` object for `order[pos]`, draws the passage, empties and focuses the typing box. Restart section calls this again for the same section.
- `renderPassage()` empties `#passage` and adds one `<span>` for each character of the target, keeping each span in `cur.spans`.
- `letterClass(i, typed)` decides the class for letter number `i` (see below).
- `paintLetters(typed)` loops over every span and sets its class with `letterClass`.
- `handleTyping()` runs on every `input` event. It cuts the typed text down if it's longer than the target, repaints the letters, and calls `finishSection()` when the typed text exactly equals the target.
- `finishSection()` disables the box and moves on. (Phase 6 will show a result panel here instead.)
- `nextSection()` adds 1 to `pos` and loads that section, or shows the done screen after the last one. Skip calls this too.
- `blockPaste(event)` calls `preventDefault()` so pasting (and dragging text in) does nothing.
- `handleTypingKeys(event)` blocks Enter, because a new line can never match the target.

The Start button is disabled when there are no sections, so you can't start an empty game.

### Explain it: why one span per letter, and how each letter's class is decided

A `<p>` of plain text can only have one colour. To colour each letter separately, each letter needs its own element, so the passage is built from one `<span>` per character. Now the code can say "make letter 7 red" by changing the class on `cur.spans[7]`.

Every time you type, `letterClass` looks at each position `i` and compares it with how much you've typed:

1. If `i` is less than the typed length, you've typed that letter. If your letter matches the target letter it's `ok` (green), otherwise `bad` (red).
2. If `i` equals the typed length, it's the very next letter to type, so it gets `cur` (the caret).
3. Otherwise you haven't reached it, so it gets no class and stays grey.

Backspacing makes the typed text shorter, so the letter you deleted falls into rule 2 or 3 again and goes back to grey. The caret is drawn with `box-shadow: inset 2px 0 0` (a 2px line on the left edge of the letter) instead of a colour change, so the letter itself stays grey. A `@keyframes` animation switches the shadow off halfway through each second, which makes it blink.

## Phase 6: WPM and accuracy

### What was added

- **HTML:** a stats strip (`#wpmStat`, `#accStat`, `#timeStat`). The passage, typing box and buttons are now wrapped in `#typingArea`, and there's a new `#resultPanel` with Next section, Try again and End session buttons.
- **JavaScript:** `cur` now also keeps `prevTyped`, `keystrokes`, `errors`, `startTime` and `endTime`. There are new top-level variables: `statsTimer` (the interval id), `lastResult` and `previousAttempt`.

### The new functions

- `scoreNewCharacters(typed)` looks only at characters past the length of `cur.prevTyped` (the box's contents last time). Each one adds a keystroke, and a wrong one adds an error. Then it saves `typed` as the new `prevTyped`.
- `countCorrect(typed)` counts the typed characters that match the target in the same position.
- `elapsedMs()` returns the milliseconds since the first keystroke, frozen at `endTime` once the section is finished.
- `calcWpm(chars, ms)` returns `(chars ÷ 5) ÷ minutes`, or 0 for the first 1.5 seconds. Two letters typed in 0.1 seconds would otherwise show as 240 WPM.
- `calcAccuracy()` returns `(keystrokes − errors) ÷ keystrokes` as a percentage. It's rounded **down** so one slip in 300 letters shows 99%, not a rounded-up 100%.
- `formatTime(ms)` turns milliseconds into `m:ss`. `padStart(2, '0')` turns `5` into `05`.
- `startTimer()` runs on the first keystroke, not when the section loads, so reading the passage first doesn't hurt your WPM. It records `performance.now()` (a precise millisecond clock) and starts a `setInterval` that calls `updateStats()` every 250 ms.
- `stopTimer()` calls `clearInterval` and sets `statsTimer` back to `null`. It's called when a section finishes, when a new section loads, when you skip, and when you leave the play screen (`leavePlay`), so an interval is never left running in the background.
- `finishSection()` stops the clock, works out the result (`wpm`, `accuracy`, `ms`) and calls `showResult()`.
- `showResult(result)` hides the typing area, shows the result panel, and fills in the numbers and a note. On the last section the Next button says "See summary".
- `makeResultNote(result)` compares with `previousAttempt` after a retry ("up 5 WPM, down 2% accuracy") and suggests another go when accuracy is under 90%. `describeChange` writes each "up/down/same" part.
- `retrySection()` remembers the result as `previousAttempt` and reloads the section. `goNext()` clears it and moves on.
- `handlePageKeys(event)` makes Enter mean "Next" while the result panel is showing. It ignores Enter when a button has focus, because the browser already clicks a focused button on Enter, and handling it twice would skip a section.

### Explain it: why divide by 5, and why accuracy counts keystrokes

**Why ÷ 5:** words are different lengths. "a" and "mitochondria" would both count as one word, so a passage full of short words would look faster. Typing tests agree that a "word" is any 5 characters, spaces and punctuation included. That way 100 correct characters is always 20 words, whatever the text. 100 characters in 30 seconds is 20 words in 0.5 minutes, which is 40 WPM.

**Why keystrokes, not the final text:** you can't finish a section until the text is perfect, so the final text is always 100% correct. Comparing it with the target would tell us nothing. Instead we count every new character as it's typed. If you type a wrong letter, backspace and fix it, that's 2 keystrokes and 1 error, so the mistake still shows in your accuracy. Only characters beyond the previous length count, so deleting doesn't add keystrokes.

## Phase 7: Session summary and saving

### What was added

- **Setup screen:** Load sample and Clear buttons. On a first visit the sample lecture is loaded automatically.
- **Done screen:** totals (overall WPM, average score, sections completed), a table of results, and three buttons: Practise weakest sections, Do it all again, and Change transcript or mode.
- **Saving:** the transcript box is saved to `localStorage` as you type, so a reload keeps it. (The chosen mode will also be saved from Phase 8, when the mode picker exists.)

### The new state

- `results` is an object keyed by section number, e.g. `results[2] = { wpm: 54, score: 97, ms: 41000, chars: 230, attempts: 1 }`. `startRun` empties it, so each run has its own summary.
- `runMode` is the study mode for this run. For now it is always `'copy'`, where the score is the accuracy.

### The new functions

- `recordResult(index, result)` stores a finished section's result. A retry replaces the old one but adds 1 to `attempts`.
- `showSummary()` stops the timer, fills in the done screen and shows it. It runs after the last section and from End session.
- `completedSections()` lists the section numbers that have a result. A skipped section never calls `recordResult`, so it never shows up in the table.
- `weakLimit()` returns 92 in Copy mode and 80 in the other modes. A score below this gets a "weak" pill.
- `renderSummary()` adds up characters, time and scores while building one table row per completed section.
- `makeResultRow(index, result)` and `makeCell(text)` build the table with `createElement` and `textContent`. Using `textContent` (not `innerHTML`) means a transcript containing something like `<script>` is shown as text and never run.
- `weaknessRank(result)` is `score × 2 + wpm ÷ 2`. Lower means weaker. Score is doubled because getting it right matters more than speed.
- `weakestSections()` sorts the completed sections by that rank, keeps the bottom third (`Math.round(count ÷ 3)`, at least 1), and puts them back in their original order. Practise weakest sections calls `startRun` with that list.
- `loadSaved(key)` and `save(key, value)` wrap `localStorage` in `try/catch`. Some browsers block storage (for example in some private modes), and then `localStorage` throws an error. Catching it means the app keeps working and simply doesn't remember.
- `setTranscript(text)` puts text in the box, saves it and re-sections it. Load sample and Clear both use it.
- `restoreTranscript()` runs at startup. If nothing was ever saved (`null`), it loads the sample. If an empty string was saved, the user cleared the box on purpose, so it stays empty.

The snippet column uses CSS to stay on one line: `white-space: nowrap` stops wrapping, `overflow: hidden` hides the rest, and `text-overflow: ellipsis` adds the "...". `table-layout: fixed` is needed so the column shrinks instead of stretching the table.

### Explain it: why total characters ÷ total time is fairer than averaging WPMs

Say you type a short 50-character section in 10 seconds (60 WPM) and a long 500-character section in 200 seconds (30 WPM). The average of the two WPMs is 45, but that treats a 10-second sprint as equal to over three minutes of typing. Overall you typed 550 characters in 210 seconds, which is (550 ÷ 5) ÷ 3.5 minutes ≈ 31 WPM. That's your real speed across the session. Adding up all the characters and all the time weights each section by how much typing it actually took, so short sections can't inflate the result.
