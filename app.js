const source = document.getElementById('source');
const startBtn = document.getElementById('startBtn');
const backBtn = document.getElementById('backBtn');
function show(view) {
    const sections = document.querySelectorAll("section");
    
    sections.forEach(section => {
        section.hidden = section.id !== view;
    })
}
function cleanTranscript(raw) {
    let text = raw;
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}
startBtn.addEventListener('click', () => show('play'));
backBtn.addEventListener('click', () => show('setup'));
source.addEventListener('input', () => {
    console.log(cleanTranscript(source.value));
})
show('setup');