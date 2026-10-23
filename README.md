# transcript-racer
Input transcript then have to type up the transcripts in a typeracer style game, used for revision hope to be able to use ai to summarise the transcripts

## Progress
- [x] Screens: setup, play and done, switched with `show()`
- [x] Cleaning: removes timestamps, `[Music]`-style tags, filler words (optional) and hard-to-type characters
- [x] Sections: splits the cleaned text into sentences and groups them into sections
- [x] Typing game: per-letter colouring, blinking caret, paste blocked, restart and skip
- [x] WPM and accuracy: live stats strip, result panel with Next / Try again / End session
- [ ] Session summary and saving
- [ ] Fill-the-blanks mode
- [ ] Recall mode
- [ ] Make it look good
- [ ] Ship it

## How it works so far
1. **Cleaning** (`cleanTranscript`) runs a series of regex find-and-replace steps on the pasted text and counts what each step removed.
2. **Splitting** (`splitSentences`) cuts the text at any space that follows `.`, `!` or `?`. Numbers like `3.5` stay together because there's no space after the dot.
3. **Long sentences** (`chopLongSentence`): auto-generated captions often have no punctuation, so anything over 260 characters is chopped into ~200 character pieces between words.
4. **Grouping** (`groupSentences`) bundles the sentences into sections, with the size picked from a dropdown.

Everything re-runs live whenever the transcript, filler checkbox or section size changes.
