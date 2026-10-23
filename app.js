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

// the current list of sections, made from the cleaned transcript
let sections = [];

// the current run: which section numbers to play, and how far through we are
let order = [];
let pos = 0;

// everything about the section being typed right now (set by loadSection)
let cur = null;

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
    cur = {
        index: order[pos],
        target: sections[order[pos]],
        spans: []
    };
    sectionLabel.textContent = `Section ${pos + 1} of ${order.length}`;
    renderPassage();
    typeBox.value = '';
    typeBox.disabled = false;
    paintLetters('');
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
    paintLetters(typed);

    if (typed === cur.target) {
        finishSection();
    }
}

// Runs when the typed text exactly matches the target.
function finishSection() {
    typeBox.disabled = true;
    nextSection();
}

// Move to the next section in the run, or to the done screen after the last one.
function nextSection() {
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
backBtn.addEventListener('click', () => show('setup'));
source.addEventListener('input', update);
fillers.addEventListener('change', update);
perSection.addEventListener('change', update);
typeBox.addEventListener('input', handleTyping);
typeBox.addEventListener('keydown', handleTypingKeys);
typeBox.addEventListener('paste', blockPaste);
typeBox.addEventListener('drop', blockPaste);
restartBtn.addEventListener('click', loadSection);
skipBtn.addEventListener('click', nextSection);
passage.addEventListener('click', () => typeBox.focus());

show('setup');
update();
