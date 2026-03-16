const Music = (() => {
  const BATTLE_TRACKS = ['audio/battle01.mp3', 'audio/battle02.mp3'];
  const VICTORY_TRACK = 'audio/Victory.mp3';

  let current = null;
  let battleIndex = 0;

  function stop() {
    if (current) {
      current.pause();
      current.currentTime = 0;
      current = null;
    }
  }

  function play(src, loop) {
    stop();
    const audio = new Audio(src);
    audio.loop = loop;
    audio.volume = 0.5;
    audio.play().catch(() => {});
    current = audio;
  }

  function playBattle() {
    play(BATTLE_TRACKS[battleIndex % BATTLE_TRACKS.length], true);
    battleIndex++;
  }

  function playVictory() {
    play(VICTORY_TRACK, true);
  }

  return { playBattle, playVictory, stop };
})();

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
