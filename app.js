const source = document.getElementById('source');
const startBtn = document.getElementById('startBtn');
const backBtn = document.getElementById('backBtn');
const fillers = document.getElementById('fillers');
const summary = document.getElementById('summary');
const perSection = document.getElementById('perSection');
const preview = document.getElementById('preview');
const sectionLabel = document.getElementById('sectionLabel');
const passage = document.getElementById('passage');
const typeBox = document.getElementById('typeBox');
const restartBtn = document.getElementById('restartBtn');
const skipBtn = document.getElementById('skipBtn');
const wpmStat = document.getElementById('wpmStat');
const accStat = document.getElementById('accStat');
const timeStat = document.getElementById('timeStat');
const typingArea = document.getElementById('typingArea');
const resultPanel = document.getElementById('resultPanel');
const resultWpm = document.getElementById('resultWpm');
const resultAcc = document.getElementById('resultAcc');
const resultTime = document.getElementById('resultTime');
const resultNote = document.getElementById('resultNote');
const nextBtn = document.getElementById('nextBtn');
const retryBtn = document.getElementById('retryBtn');
const endBtn = document.getElementById('endBtn');
const sampleBtn = document.getElementById('sampleBtn');
const clearBtn = document.getElementById('clearBtn');
const totalWpm = document.getElementById('totalWpm');
const totalScore = document.getElementById('totalScore');
const totalDone = document.getElementById('totalDone');
const resultsTable = document.getElementById('resultsTable');
const resultsBody = document.getElementById('resultsBody');
const noResults = document.getElementById('noResults');
const weakestBtn = document.getElementById('weakestBtn');
const againBtn = document.getElementById('againBtn');
const changeBtn = document.getElementById('changeBtn');

// the names the app saves things under in localStorage
const SOURCE_KEY = 'transcriptRacer.source';

// the example lecture used by "Load sample" and on a first visit
const SAMPLE_TRANSCRIPT = `0:00
[Music]
0:03
okay so today we're going to talk about um the mitochondria and what it
0:07
actually does. Most people remember it as the powerhouse of the cell,
0:11
but that phrase hides the interesting part. [Applause]
0:15
The mitochondria turns the energy stored in glucose into ATP, which is
0:19
the molecule your cells actually spend. This happens in a process
0:23
called cellular respiration, and uh it has three main stages.
0:28
The first stage is glycolysis, and it happens in the cytoplasm, outside
0:32
the mitochondria. It splits one glucose molecule into two molecules of
0:36
pyruvate and gives a small amount of ATP.
0:40
The second stage is the Krebs cycle, which takes place in the matrix,
0:44
the fluid inside the mitochondria. It releases carbon dioxide and loads
0:48
up carrier molecules called NADH and FADH2.
0:52
The third stage is the electron transport chain on the inner membrane.
0:57
This is where most of the ATP is made, around thirty to thirty-two
1:01
molecules per glucose. Oxygen is the final electron acceptor, which is
1:05
um why you need to breathe. Without oxygen, the chain stops.
1:10
(laughter) So next time someone says powerhouse of the cell, you can
1:14
tell them exactly how the power gets made.`;

// the current list of sections, made from the cleaned transcript
let sections = [];

// the current run: which section numbers to play, and how far through we are
let order = [];
let pos = 0;

// everything about the section being typed right now (set by loadSection)
let cur = null;

// the id of the interval that refreshes the live stats, or null if none is running
let statsTimer = null;

// the result of the section just finished, and of the attempt before a retry
let lastResult = null;
let previousAttempt = null;

// results for this run, keyed by section number: { wpm, score, ms, chars, attempts }
let results = {};

// the study mode for this run (only 'copy' for now)
let runMode = 'copy';

function show(view) {
    const screens = document.querySelectorAll("section");
    screens.forEach(screen => {
        screen.hidden = screen.id !== view;
    });
}

function cleanTranscript(raw, removeFillers) {
    const removed = { timestamps: 0, tags: 0, fillers: 0 };
    let text = raw;

    // remove junk, counting as we go
    text = text.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, () => { removed.timestamps++; return ' '; });
    text = text.replace(/\[[^\]]*\]/g, () => { removed.tags++; return ' '; });
    text = text.replace(/\((music|applause|laughter|laughs|inaudible|crosstalk)\)/gi, () => { removed.tags++; return ' '; });
    if (removeFillers) {
        text = text.replace(/\b(um+|uh+|erm+|hmm+)\b,?/gi, () => { removed.fillers++; return ' '; });
    }

    // swap hard-to-type characters
    text = text.replace(/[‘’]/g, "'");
    text = text.replace(/[“”]/g, '"');
    text = text.replace(/[–—]/g, '-');
    text = text.replace(/…/g, '...');
    text = text.replace(/ /g, ' ');

    // tidy up
    text = text.replace(/\s+/g, ' ').trim();
    text = text.replace(/\s+([,.!?])/g, '$1');

    return { text: text, removed: removed };
}

// Split text into sentences.
// Splits at a space that comes straight after . ! or ?
// so "3.5" stays together (no space after the dot).
function splitSentences(text) {
    if (text === '') return [];
    return text.split(/(?<=[.!?])\s+/);
}

// Auto-generated captions often have no punctuation, so one "sentence"
// can be the whole transcript. Chop anything too long into ~200 character
// pieces, breaking between words.
function chopLongSentence(sentence) {
    if (sentence.length <= 260) return [sentence];

    const pieces = [];
    let current = '';
    for (const word of sentence.split(' ')) {
        if (current.length + word.length + 1 > 200) {
            pieces.push(current);
            current = word;
        } else {
            current = current === '' ? word : current + ' ' + word;
        }
    }
    if (current !== '') pieces.push(current);
    return pieces;
}

// Bundle sentences into sections of `size` sentences each.
function groupSentences(sentences, size) {
    const groups = [];
    for (let i = 0; i < sentences.length; i += size) {
        groups.push(sentences.slice(i, i + size).join(' '));
    }
    return groups;
}

function makeSections(text, size) {
    const sentences = splitSentences(text).flatMap(chopLongSentence);
    return groupSentences(sentences, size);
}

function update() {
    const result = cleanTranscript(source.value, fillers.checked);
    const r = result.removed;

    sections = makeSections(result.text, Number(perSection.value));

    summary.textContent =
        `${sections.length} sections. Removed ${r.timestamps} timestamps, ${r.tags} tags and ${r.fillers} filler words`;
    preview.textContent = sections[0] || 'Paste a transcript to see a preview.';
    startBtn.disabled = sections.length === 0;
}

// Start a run through the given section numbers, beginning with the first.
function startRun(sectionNumbers) {
    order = sectionNumbers;
    pos = 0;
    results = {};
    previousAttempt = null;
    show('play');
    loadSection();
}

// Start a run through every section, in order.
function startAll() {
    const all = [];
    for (let i = 0; i < sections.length; i++) {
        all.push(i);
    }
    startRun(all);
}

// Set up the section at position `pos` of the run, ready to be typed.
function loadSection() {
    stopTimer();
    cur = {
        index: order[pos],
        target: sections[order[pos]],
        spans: [],
        prevTyped: '',     // what the box held before the latest input
        keystrokes: 0,     // new characters typed
        errors: 0,         // new characters that were wrong
        startTime: null,   // set on the first keystroke
        endTime: null      // set when the section is finished
    };
    sectionLabel.textContent = `Section ${pos + 1} of ${order.length}`;
    renderPassage();
    typeBox.value = '';
    typeBox.disabled = false;
    typingArea.hidden = false;
    resultPanel.hidden = true;
    paintLetters('');
    updateStats();
    typeBox.focus();
}

// Put the target text on screen as one <span> per character,
// so each letter can be coloured on its own.
function renderPassage() {
    passage.textContent = '';
    cur.spans = [];
    for (let i = 0; i < cur.target.length; i++) {
        const span = document.createElement('span');
        span.textContent = cur.target[i];
        passage.appendChild(span);
        cur.spans.push(span);
    }
}

// Work out the class for the letter at position i:
// 'ok' if typed correctly, 'bad' if typed wrongly,
// 'cur' if it's the next one to type, and '' (plain grey) if not reached yet.
function letterClass(i, typed) {
    if (i < typed.length) {
        if (typed[i] === cur.target[i]) return 'ok';
        return 'bad';
    }
    if (i === typed.length) return 'cur';
    return '';
}

// Give every letter in the passage its class, based on what's been typed.
function paintLetters(typed) {
    for (let i = 0; i < cur.spans.length; i++) {
        cur.spans[i].className = letterClass(i, typed);
    }
}

// Runs every time the typing box changes.
function handleTyping() {
    // never let the typed text get longer than the target
    if (typeBox.value.length > cur.target.length) {
        typeBox.value = typeBox.value.slice(0, cur.target.length);
    }

    const typed = typeBox.value;
    if (cur.startTime === null && typed.length > 0) {
        startTimer();
    }
    scoreNewCharacters(typed);
    paintLetters(typed);

    if (typed === cur.target) {
        finishSection();
    }
}

// Count keystrokes and errors, but only for characters beyond what was
// there last time. Backspacing and retyping a letter counts as a new keystroke,
// so a mistake that gets fixed still stays in the error count.
function scoreNewCharacters(typed) {
    for (let i = cur.prevTyped.length; i < typed.length; i++) {
        cur.keystrokes++;
        if (typed[i] !== cur.target[i]) {
            cur.errors++;
        }
    }
    cur.prevTyped = typed;
}

// How many typed characters match the target in the same position.
function countCorrect(typed) {
    let correct = 0;
    for (let i = 0; i < typed.length; i++) {
        if (typed[i] === cur.target[i]) correct++;
    }
    return correct;
}

// Milliseconds since the first keystroke (frozen once the section is finished).
function elapsedMs() {
    if (cur.startTime === null) return 0;
    if (cur.endTime !== null) return cur.endTime - cur.startTime;
    return performance.now() - cur.startTime;
}

// Words per minute, where a "word" is any 5 characters.
// Shows 0 for the first 1.5 seconds, when a couple of quick letters
// would otherwise look like a silly speed.
function calcWpm(chars, ms) {
    if (ms < 1500) return 0;
    const minutes = ms / 60000;
    return Math.round((chars / 5) / minutes);
}

// Percentage of keystrokes that were right. Rounded down, so a single
// mistake never gets rounded back up to 100%.
function calcAccuracy() {
    if (cur.keystrokes === 0) return 100;
    return Math.floor((cur.keystrokes - cur.errors) / cur.keystrokes * 100);
}

// Turn milliseconds into m:ss, e.g. 75000 -> "1:15".
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Start the clock and refresh the live stats 4 times a second.
function startTimer() {
    cur.startTime = performance.now();
    statsTimer = setInterval(updateStats, 250);
}

// Stop refreshing the live stats. Safe to call even if nothing is running.
function stopTimer() {
    clearInterval(statsTimer);
    statsTimer = null;
}

// Write the current WPM, accuracy and time into the stats strip.
function updateStats() {
    const ms = elapsedMs();
    wpmStat.textContent = calcWpm(countCorrect(typeBox.value), ms);
    accStat.textContent = calcAccuracy() + '%';
    timeStat.textContent = formatTime(ms);
}

// Runs when the typed text exactly matches the target.
function finishSection() {
    cur.endTime = performance.now();
    stopTimer();
    updateStats();
    typeBox.disabled = true;

    const ms = elapsedMs();
    const accuracy = calcAccuracy();
    lastResult = {
        wpm: calcWpm(cur.target.length, ms),
        accuracy: accuracy,
        score: accuracy,   // in Copy mode, the main score is accuracy
        ms: ms,
        chars: cur.target.length
    };
    recordResult(cur.index, lastResult);
    showResult(lastResult);
}

// Save a section's result for the summary. A retry replaces the old
// result but keeps counting the attempts.
function recordResult(index, result) {
    let attempts = 1;
    if (results[index] !== undefined) {
        attempts = results[index].attempts + 1;
    }
    results[index] = {
        wpm: result.wpm,
        score: result.score,
        ms: result.ms,
        chars: result.chars,
        attempts: attempts
    };
}

// Swap the typing area for the result panel and fill it in.
function showResult(result) {
    typingArea.hidden = true;
    resultPanel.hidden = false;
    resultWpm.textContent = result.wpm;
    resultAcc.textContent = result.accuracy + '%';
    resultTime.textContent = formatTime(result.ms);
    resultNote.textContent = makeResultNote(result);

    if (pos === order.length - 1) {
        nextBtn.textContent = 'See summary';
    } else {
        nextBtn.textContent = 'Next section';
    }
    nextBtn.focus();
}

// A short comment on the result: compare with the last try, and
// suggest another go if accuracy was under 90%.
function makeResultNote(result) {
    const notes = [];
    if (previousAttempt !== null) {
        const wpmChange = result.wpm - previousAttempt.wpm;
        const accChange = result.accuracy - previousAttempt.accuracy;
        notes.push(`Compared with last try: ${describeChange(wpmChange, ' WPM')}, ${describeChange(accChange, '% accuracy')}.`);
    }
    if (result.accuracy < 90) {
        notes.push('Accuracy was under 90%, so this one could use another go.');
    }
    return notes.join(' ');
}

// Describe a change as "up 5 WPM", "down 2% accuracy" or "same WPM".
function describeChange(amount, unit) {
    if (amount > 0) return `up ${amount}${unit}`;
    if (amount < 0) return `down ${-amount}${unit}`;
    return `same${unit}`;
}

// Try the same section again, remembering this result to compare against.
function retrySection() {
    previousAttempt = lastResult;
    loadSection();
}

// Go on from the result panel to the next section.
function goNext() {
    previousAttempt = null;
    nextSection();
}

// Leave the play screen for another screen, making sure the stats timer stops.
function leavePlay(view) {
    stopTimer();
    show(view);
}

// Enter on the result panel means "Next". Buttons handle their own Enter,
// so ignore it when a button has focus (otherwise it would fire twice).
function handlePageKeys(event) {
    if (event.key !== 'Enter') return;
    if (resultPanel.hidden || document.getElementById('play').hidden) return;
    if (event.target.tagName === 'BUTTON') return;
    event.preventDefault();
    goNext();
}

// Move to the next section in the run, or to the done screen after the last one.
function nextSection() {
    stopTimer();
    pos++;
    if (pos < order.length) {
        loadSection();
    } else {
        showSummary();
    }
}

// Finish the run: stop the clock, fill in the summary and show the done screen.
function showSummary() {
    stopTimer();
    renderSummary();
    show('done');
}

// The section numbers that have a result, smallest first.
// Skipped sections never get a result, so they aren't included.
function completedSections() {
    const done = [];
    for (const index of order) {
        if (results[index] !== undefined) done.push(index);
    }
    return done.sort((a, b) => a - b);
}

// The score below which a section counts as weak. Copying is easier,
// so the bar is higher there.
function weakLimit() {
    if (runMode === 'copy') return 92;
    return 80;
}

// Fill in the totals and the table on the done screen.
function renderSummary() {
    const done = completedSections();
    let totalChars = 0;
    let totalMs = 0;
    let scoreSum = 0;
    resultsBody.textContent = '';

    for (const index of done) {
        const result = results[index];
        totalChars += result.chars;
        totalMs += result.ms;
        scoreSum += result.score;
        resultsBody.appendChild(makeResultRow(index, result));
    }

    // overall WPM comes from all the characters over all the time,
    // not from averaging each section's WPM
    totalWpm.textContent = calcWpm(totalChars, totalMs);
    if (done.length > 0) {
        totalScore.textContent = Math.round(scoreSum / done.length) + '%';
    } else {
        totalScore.textContent = '-';
    }
    totalDone.textContent = `${done.length} of ${order.length}`;

    resultsTable.hidden = done.length === 0;
    noResults.hidden = done.length > 0;
    weakestBtn.disabled = done.length === 0;
}

// Build one table row: section number, a one-line snippet, WPM and score,
// with a "weak" pill if the score is under the limit.
function makeResultRow(index, result) {
    const row = document.createElement('tr');
    row.appendChild(makeCell(index + 1));

    // CSS cuts the snippet to one line with an ellipsis (...)
    const snippet = makeCell(sections[index]);
    snippet.className = 'snippet';
    row.appendChild(snippet);

    row.appendChild(makeCell(result.wpm));

    const scoreCell = makeCell(result.score + '%');
    if (result.score < weakLimit()) {
        const pill = document.createElement('span');
        pill.className = 'pill';
        pill.textContent = 'weak';
        scoreCell.appendChild(pill);
    }
    row.appendChild(scoreCell);
    return row;
}

// Make a table cell holding some text. Using textContent (not innerHTML)
// means text from the transcript can never be treated as HTML.
function makeCell(text) {
    const cell = document.createElement('td');
    cell.textContent = text;
    return cell;
}

// A section's place in the weakest ranking: lower means weaker.
// Score counts for more than speed, because getting it right matters most.
function weaknessRank(result) {
    return result.score * 2 + result.wpm / 2;
}

// Pick the weakest third of completed sections (at least one),
// returned in their original order.
function weakestSections() {
    const done = completedSections();
    done.sort((a, b) => weaknessRank(results[a]) - weaknessRank(results[b]));

    const howMany = Math.max(1, Math.round(done.length / 3));
    const weakest = done.slice(0, howMany);
    return weakest.sort((a, b) => a - b);
}

// Read a saved value, or null if there isn't one or storage is blocked.
function loadSaved(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        return null;
    }
}

// Save a value. If storage is blocked (e.g. some private modes), carry on
// without saving rather than crashing.
function save(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        // nothing to do: the app works, it just won't remember
    }
}

// Put text in the transcript box, save it and re-section it.
function setTranscript(text) {
    source.value = text;
    save(SOURCE_KEY, text);
    update();
}

// Fill the transcript box with the saved transcript, or the sample on a
// first visit. A saved empty string means the user cleared it, so keep it empty.
function restoreTranscript() {
    const saved = loadSaved(SOURCE_KEY);
    if (saved === null) {
        source.value = SAMPLE_TRANSCRIPT;
    } else {
        source.value = saved;
    }
}

// Stop pasting (and drag-and-drop, which is pasting with the mouse).
function blockPaste(event) {
    event.preventDefault();
}

// Enter would add a new line, which never matches the target, so block it.
function handleTypingKeys(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
    }
}

startBtn.addEventListener('click', startAll);
backBtn.addEventListener('click', () => leavePlay('setup'));
source.addEventListener('input', update);
fillers.addEventListener('change', update);
perSection.addEventListener('change', update);
typeBox.addEventListener('input', handleTyping);
typeBox.addEventListener('keydown', handleTypingKeys);
typeBox.addEventListener('paste', blockPaste);
typeBox.addEventListener('drop', blockPaste);
restartBtn.addEventListener('click', loadSection);
skipBtn.addEventListener('click', goNext);
passage.addEventListener('click', () => typeBox.focus());
nextBtn.addEventListener('click', goNext);
retryBtn.addEventListener('click', retrySection);
endBtn.addEventListener('click', showSummary);
document.addEventListener('keydown', handlePageKeys);
source.addEventListener('input', () => save(SOURCE_KEY, source.value));
sampleBtn.addEventListener('click', () => setTranscript(SAMPLE_TRANSCRIPT));
clearBtn.addEventListener('click', () => {
    setTranscript('');
    source.focus();
});
weakestBtn.addEventListener('click', () => startRun(weakestSections()));
againBtn.addEventListener('click', startAll);
changeBtn.addEventListener('click', () => show('setup'));

restoreTranscript();
show('setup');
update();
