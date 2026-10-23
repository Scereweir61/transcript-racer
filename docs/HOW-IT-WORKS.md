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
