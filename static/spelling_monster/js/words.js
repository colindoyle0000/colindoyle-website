const WORDS = [
  'yelled', 'yarn', 'yellow', 'yes', 'myth',
  'symbol', 'system', 'cry', 'frying', 'satisfy',
  'yawn', 'sticky', 'lying', 'energy'
];

function shuffleWords(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
