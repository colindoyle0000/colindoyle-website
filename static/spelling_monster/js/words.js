const WORDS = [
  'field', 'piece', 'shield', 'thief', 'kitties',
  'achieve', 'relief', 'grief', 'yield', 'movie',
  'niece', 'cookies', 'ladies', 'babies'
];

function shuffleWords(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
