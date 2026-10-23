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
    lastResult = {
        wpm: calcWpm(cur.target.length, ms),
        accuracy: calcAccuracy(),
        ms: ms
    };
    showResult(lastResult);
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
        show('done');
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
endBtn.addEventListener('click', () => leavePlay('done'));
document.addEventListener('keydown', handlePageKeys);

show('setup');
update();
