# How Transcript Racer works

This file explains the code one phase at a time, in plain English. Phases 1–4 (screens, cleaning and sectioning) are summarised in the README's "How it works" section.

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

## Phase 8: Fill-the-blanks mode

### What was added

- **Setup screen:** a "Study mode" picker (radio buttons) with Copy and Fill the blanks. "How many blanks" (A few / Some / Loads) only shows when Fill the blanks is ticked. The chosen mode is saved in `localStorage`. Recall gets its radio button in Phase 9, once it works.
- **Play screen:** in Fill the blanks, some key words are shown as `_` in the accent colour. As you type over a blank, your own letters appear (green if right, red if wrong, and a typed space shows as `·`). Tab or the "Reveal word" button reveals the next blank, highlighted.
- **Result panel:** a "Blanks recalled x/y" row in Fill the blanks.

### Refactor

`letterClass` used to return one class name. Now a letter can have more than one (for example `blank cur`), so it builds a list and joins it with spaces. Letters also don't always show the target letter any more (a blank shows `_`), so a new `letterText` function decides the text, and `paintLetters` now sets both text and class. `renderPassage` just creates empty spans and leaves the filling-in to `paintLetters`. In Copy mode there are no blanks, so every letter takes the same path as before and behaves exactly as in Phase 5.

### The new functions

- `selectedMode()` returns the value of the ticked radio button.
- `handleModeChange()` shows or hides the blanks options and saves the mode. `restoreMode()` ticks the saved mode at startup.
- `findWords(text)` uses `matchAll` with `/[A-Za-z0-9][A-Za-z0-9'-]*/g` to find each word plus its `start` and `end` position. The pattern means "a letter or digit, then any mix of letters, digits, apostrophes and hyphens", so `thirty-two` and `we're` count as one word. A trailing `'` or `-` is removed.
- `countCapitals(word)` and `isSpecial(word)`: a special word (2+ characters) has a digit or at least two capitals, like `ATP` or `FADH2`.
- `isCandidate(word)`: special words always qualify. Other words need 6+ characters and must not be on the `STOP_WORDS` list (long but meaningless words like "because" or "actually"). Apostrophes are removed before the check, so "you're" is looked up as "youre".
- `blankWeight(word)` is `(length + 5 if special)²`.
- `pickBlanks(text, density)` picks `round(candidates × density)` words (at least 1) using weighted random, then sorts them back into text order.
- `makeMask(length, blanks)` builds an array with one number per character: the blank's id, or `-1` for a normal character. This lets the code ask "is letter 37 part of a blank?" with just `cur.mask[37]`.
- `revealNextBlank()` finds the first blank that isn't revealed and ends after the cursor (`end > cursor` means the cursor is inside it or before it). It reveals that blank and marks it as missed.
- `scoreNewCharacters` now also marks a blank as missed when one of its letters is mistyped.
- `scoreName()` gives the retry note the right words ("% blanks recalled" or "% accuracy").

### Scoring

A blank is **recalled** only if none of its letters were ever mistyped and it wasn't revealed. So `cur.missed` collects the id of any blank that was mistyped or revealed, and recalled = total blanks − missed. The score is recalled ÷ total as a percentage. If a section happens to have no candidate words at all, the score falls back to accuracy so the section still gets a fair number.

### Explain it: how the weighted random choice works

Take two candidates, **glycolysis** and **ATP**:

- glycolysis has 10 letters and isn't special, so its weight is 10² = **100**.
- ATP has 3 letters but is special (+5), so its weight is (3 + 5)² = **64**.

Each word gets a "luck" number: `Math.random() × weight`. `Math.random()` is anywhere from 0 to 1, so glycolysis gets a random number between 0 and 100 and ATP gets one between 0 and 64. The words are sorted by luck, biggest first, and the top N become blanks.

If we only need one blank, glycolysis wins most of the time because its range is bigger. ATP can still win, though: if glycolysis rolls 0.3 (luck 30) and ATP rolls 0.8 (luck 51.2), ATP is picked. So important-looking words are more likely to be hidden, but there's always some chance for the others, and every retry hides a different set. Squaring the length makes the gap bigger: a 10-letter word is only twice as long as a 5-letter one, but its weight is four times bigger (100 vs 25).

## Phase 9: Recall mode

### What was added

- **Setup screen:** a Recall radio button and a "Reading time before it hides" option: Auto, 5s, 10s, 20s, or Until I'm ready.
- **Play screen, study phase:** the whole text is shown with a countdown bar that drains, plus an "I'm ready, hide it" button. The typing box is disabled.
- **Play screen, recall phase:** the text is hidden behind a message giving the word count. You type freely, with no colouring and no length limit. Enter or Check submits. Peek shows the text for 2 seconds and is counted.
- **Result panel:** % recalled, words x/y, WPM, peeks and time. Below that, the original text with the words you got in green and the ones you missed in red, and "What you typed".
- The live accuracy stat is hidden in Recall, because there's no letter-by-letter target to be accurate against.

### Refactors

- `loadSection` now does the setup shared by every mode, then calls `startTyping()` (Copy and Fill the blanks, the old behaviour) or `startStudy()` (Recall).
- `finishSection` now asks `makeTypingResult()` or `makeRecallResult()` for the result. The typing one is the old code moved into its own function.
- `stopTimer` now stops all three timers the play screen can have running: live stats, the reading countdown and a peek. Everywhere that already called it (finishing, loading, skipping, leaving) now cleans up the Recall timers too.
- `handlePageKeys` ignores Enter that comes from the typing box. In Recall, that Enter submits the answer and opens the result panel. Without this check the same key press would bubble up to the page and skip straight past the result.

### The new functions

- `clamp(number, smallest, largest)` keeps a number in a range.
- `toWords(text)` splits on whitespace and drops "words" that are only punctuation.
- `readingSeconds(text)`: Auto is `clamp(round(words × 0.45), 5, 30)`. A 50-word section gets 23 seconds.
- `startStudy()` shows the text, disables the box and starts a 100 ms interval that calls `updateCountdown()`. With "Until I'm ready" (0 seconds) there's no bar and no timer.
- `updateCountdown()` sets the bar's width to the share of time left, and calls `startRecall()` when time runs out.
- `startRecall()` stops the countdown, hides the text, shows the message and enables the box.
- `peek()` adds 1 to `cur.peeks`, shows the text and sets a 2-second `setTimeout` for `endPeek()`, which hides it again. The Peek button is disabled during a peek so it can't be double-counted.
- `wpmChars()`: in Recall, WPM counts every typed character. In the other modes it counts correct ones.
- `normaliseWord(word)` lowercases and keeps only `a-z` and `0-9`, so `"Cell,"` and `cell` are equal.
- `wordDiff(target, typed)` scores the answer using the longest common subsequence (below).
- `showRecallResult(result)` builds the green/red original with one `<span>` per word.

### Explain it: the longest common subsequence (LCS)

A **subsequence** is what's left when you cross out some words but keep the rest in order. The **longest common subsequence** of two texts is the longest list of words you can get from both that way. The score is LCS length ÷ number of original words.

**Example.** Original: *the cell makes energy*. Typed: *cell makes some energy* (forgot "the", added "some").

We fill a table where `table[i][j]` is the LCS of the first `i` original words and the first `j` typed words. Row 0 and column 0 mean "no words yet", so they're 0.

|            | (none) | cell | makes | some | energy |
|------------|:------:|:----:|:-----:|:----:|:------:|
| **(none)** | 0 | 0 | 0 | 0 | 0 |
| **the**    | 0 | 0 | 0 | 0 | 0 |
| **cell**   | 0 | **1** | 1 | 1 | 1 |
| **makes**  | 0 | 1 | **2** | 2 | 2 |
| **energy** | 0 | 1 | 2 | 2 | **3** |

The rule for each cell:

- If the two words match, take the cell diagonally up-left and add 1. For example "makes" = "makes" gives 1 + 1 = 2.
- If they don't match, copy the bigger of the cell above and the cell to the left.

"the" never matches, so its row is all 0. The bottom-right cell is **3**, so the LCS is 3 words.

**Backtracking** finds *which* words. Start at the bottom-right. "energy" = "energy", so it's a hit and we step diagonally. "makes" vs "some" don't match, so we step towards the bigger neighbour (left, the 2). "makes" = "makes" is a hit, then "cell" = "cell" is a hit. We end up in the "the" row, where nothing matched. Hits are cell, makes and energy. Score: 3 ÷ 4 = **75%**, and "the" is shown in red.

**Why it beats "% of words that appear anywhere":** that simpler method ignores order. Typing *energy makes cell the* would score 100%, even though it's word salad. With LCS, the longest list of words in the same order in both is just 1 word, so it scores 25%. LCS rewards remembering what was said *and in what order*, which is what understanding a lecture needs, while still forgiving a missed or extra word here and there. Punctuation and capitals don't count against you because both texts go through `normaliseWord` first.

The table has (original words + 1) × (typed words + 1) cells, so a 50-word section with a 50-word answer fills about 2,600 cells, which is instant.

## Phase 10: Make it look good

### What was added

- **Notebook desk look:** a dot-grid background, 2px dark outlines, hard offset shadows (`box-shadow: 6px 6px 0`) and rounded cards.
- **Highlighter palette:** yellow, pink and blue. Each mode has its own colour (Copy is yellow, Fill the blanks pink, Recall blue), used for buttons, the car, the logo sticker and the progress dots.
- **Fonts** from Google Fonts: Bricolage Grotesque for headings, Nunito for body text and JetBrains Mono for the passage. Each has a fallback stack (e.g. `Consolas, "Courier New", monospace`), so the app still looks fine offline.
- **Fun touches:** a car that drives to a chequered flag as you type, a streak counter that pops every 25 correct letters in a row, a shake on a mistake, progress dots, an S/A/B/C/D grade stamp with a random title, confetti, and a personal-best WPM per mode.
- **Casual copy:** "Let's go →", "Run it back", "I'm done", "Drill my weakest bits", "Poof, it's gone!".
- **Buttons** sink into their shadow when pressed (`:active` moves them 4px and removes the shadow). Anything focusable gets a thick outline with `:focus-visible`, which shows for keyboard users but not on mouse clicks.
- **Responsive:** setup is two columns from 800px wide and stacked below that. I checked every screen in a 400px-wide frame and none of them scroll sideways.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, all animations and transitions are switched off (the caret stops blinking but stays visible) and confetti is skipped.

### HTML changes

The page now has a header with the logo, and each screen's content sits in `.card` boxes. Every id from earlier phases is unchanged, so the JavaScript only needed additions. Cards are `<div>`s, not `<section>`s, because `show()` treats every `<section>` as a screen. New elements: `#dots`, the `#track` with an inline SVG `#car` and a `.flag`, `#streakBox`, the `#stamp` with `#resultTitle` and `#pbNote`, and a full-screen `<canvas id="confetti">`.

### The new functions

- `handleModeChange()` now also sets `document.body.dataset.mode`, which writes `data-mode="blanks"` on `<body>`. The CSS rule `body[data-mode="blanks"] { --mode: var(--pink); }` then recolours everything that uses `var(--mode)`.
- `renderDots()` draws one dot per section in the run: filled when finished, grey when skipped, with a ring around the current one.
- `moveCar(fraction)` sets the car's `left` to a percentage of the road. It also shifts the car back by the same percentage of its own width (`translateX(-50%)` at halfway), so at 100% its front bumper stops exactly at the flag instead of driving off the end.
- `restartAnimation(element, className)` replays a CSS animation. Removing a class and adding it straight back does nothing, because the browser only looks at the end result. Reading `element.offsetWidth` in between makes the browser lay out the page with the class removed, so adding it again counts as new.
- `scoreNewCharacters` now calls `addToStreak()` for a correct letter and `recordMistake(i)` for a wrong one. `addToStreak` counts up and pops the counter every 25 (`streak % 25 === 0`). `recordMistake` holds the old error-counting code, and also resets the streak and shakes the passage.
- `gradeFor(score)` gives S (97+), A (90+), B (80+), C (65+) or D. `showStamp(score)` shows the letter, picks a title with `randomItem(GRADE_TITLES[grade])` and plays the stamp animation.
- `checkPersonalBest(wpm)` reads the best WPM for the current mode from `localStorage` (key `transcriptRacer.best.copy` and so on) and saves the new one if it's higher. It returns `true` only when an existing best was beaten, so your very first section doesn't throw confetti just for existing.
- `launchConfetti()` returns straight away if `prefersReducedMotion()` is true. Otherwise it sizes the canvas to the window, makes 120 pieces (`makeConfettiPiece`) in the highlighter colours (`confettiColours()` reads them from the CSS variables, so dark mode gets the dark palette), and starts `drawConfetti`.
- `drawConfetti(now)` clears the canvas, moves each piece, adds a little to its downward speed (gravity), spins it, draws it as a small rotated rectangle, and asks `requestAnimationFrame` for the next frame until 2.5 seconds have passed. Confetti fires for a score of 90%+ or a new personal best.

### Explain it: CSS variables and dark mode

A **CSS variable** (custom property) is a named value you define once and reuse:

```css
:root {
    --ink: #1d1b26;
}
.card {
    border: 2px solid var(--ink);
}
```

`:root` means the `<html>` element, so variables set there are available everywhere. Every colour in `style.css` is a variable on `:root`, and component rules like `.card` or `.btn` only ever say `var(--something)`. They never contain a colour value themselves.

**Dark mode** is one media query that gives the *same variable names* new values:

```css
@media (prefers-color-scheme: dark) {
    :root {
        --ink: #f2ecdf;
        --paper: #16141d;
    }
}
```

When the computer is set to dark mode, the browser uses the second set of values. Because `.card` still says `var(--ink)`, it picks up the dark value automatically. None of the component rules are written twice. Adding a new component means using the existing variables, and it works in both themes for free.

The mode colours work the same way. `--mode` is a variable, and `body[data-mode="recall"]` sets it to `var(--blue)`. Variables pass down to child elements, so every button, dot and car inside the body turns blue.

## Phase 11: Ship it

### Ready for a static host

A static host (like GitHub Pages) just sends your files to the browser as they are, so the app needs no server code. The only thing that matters is the paths. `index.html` loads `style.css` and `app.js` with **relative** paths (`href="style.css"`, not `C:\...` or `/style.css`), so they're found next to `index.html` wherever the folder ends up, including a sub-path like `/transcript-racer/`. The only full URL is Google Fonts, which is `https://` and works from any site. If the fonts can't load, the fallback fonts take over.

### Putting it on GitHub Pages

You do this part. It's a repo setting, and it's quick:

1. **Push your commits** so GitHub has the latest code. In the VS Code terminal (PowerShell):
   ```powershell
   git push
   ```
2. Open **https://github.com/Scereweir61/transcript-racer** in your browser.
3. Click **Settings** (the gear tab along the top of the repo).
4. In the left sidebar, under **Code and automation**, click **Pages**.
5. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
6. Under **Branch**, choose **main** and the folder **/ (root)**, then click **Save**.
7. Wait a minute or two, then refresh the Pages settings. A box at the top will say **"Your site is live at https://scereweir61.github.io/transcript-racer/"**.
8. Open that link and test it: load the sample and play a section in each mode.
9. Optional: on the repo's main page, click the gear next to **About** and tick **Use your GitHub Pages website**, so the link shows at the top of the repo.

From then on, every `git push` to `main` updates the live site automatically (allow a minute). On a free account the repository has to be **public** for Pages to work. If the page shows a 404 at first, wait a couple of minutes, because the first deploy can be slow. You can follow its progress in the repo's **Actions** tab.

### README

`README.md` was rewritten for visitors and recruiters. It has a one-line pitch, the live link, a screenshot placeholder, features, how it works (cleaning, sectioning, scoring and LCS), tech used, challenges and how they were solved, known limitations, and what's next. Replace the screenshot placeholder with a real image or GIF when you can: a short screen recording of a race in each mode is ideal.

### CV bullet points

These only describe things the app really does:

- Built **Transcript Racer**, a browser-based study tool in vanilla HTML, CSS and JavaScript (no frameworks or build tools) that turns lecture transcripts into typing drills with three study modes: copy, fill-the-blanks and timed recall.
- Wrote a **regex text-processing pipeline** that strips caption timestamps, tags and filler words, normalises un-typeable Unicode characters, and splits text into sections, with a fallback for unpunctuated auto-generated captions.
- Implemented a **longest-common-subsequence (dynamic programming) algorithm** to score free-recall answers by word order, plus a weighted random selector that picks key terms to blank out, and fair WPM/accuracy metrics based on keystrokes and total time.
- Designed a **responsive, accessible UI** with CSS custom-property theming (automatic dark mode), reduced-motion support, keyboard controls and `localStorage` persistence, and deployed it as a static site on **GitHub Pages**.
