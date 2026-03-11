const Audio = (() => {
  let voices = [];
  let preferred = null;

  function loadVoices() {
    voices = speechSynthesis.getVoices();
    // Prefer a natural English voice
    preferred = voices.find(v => v.lang.startsWith('en') && v.localService) ||
                voices.find(v => v.lang.startsWith('en')) ||
                voices[0] || null;
  }

  if (typeof speechSynthesis !== 'undefined') {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  function speakWord(word, onEnd) {
    if (typeof speechSynthesis === 'undefined') {
      if (onEnd) onEnd();
      return;
    }
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(word);
    utt.lang = 'en-US';
    utt.rate = 0.85;
    utt.pitch = 1.0;
    utt.volume = 1.0;
    if (preferred) utt.voice = preferred;
    if (onEnd) utt.onend = onEnd;
    speechSynthesis.speak(utt);
  }

  function cancel() {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }

  return { speakWord, cancel };
})();
