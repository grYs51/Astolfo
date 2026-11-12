import { renderPng } from './render';
import { ordinal, triviaQuestionCard, triviaResultCard, triviaScoreboardCard, triviaStatsCard, wrap } from './trivia.card';
import { THEMES } from './themes';

const question = {
  category: 'Science & Nature',
  difficulty: 'hard',
  factor: 2,
  question: 'Which <element> has the chemical symbol "Au"?',
  answers: ['Silver', 'Gold', 'Argon', 'Copper'],
  seconds: 20,
};

describe('wrap', () => {
  test('breaks on words and cuts what does not fit in the last line', () => {
    expect(wrap('one two three four', 9, 3)).toEqual(['one two', 'three', 'four']);
    expect(wrap('one two three four five six', 9, 2)).toEqual(['one two', 'three …']);
  });
});

describe('triviaQuestionCard', () => {
  test('shows the category, the multiplier, the escaped question and every answer', async () => {
    const svg = triviaQuestionCard(question, THEMES.dark);
    expect(svg).toContain('>Science &amp; Nature<');
    expect(svg).toContain('>Hard · ×2 XP<');
    expect(svg).toContain('&lt;element&gt;');
    for (const letter of ['A', 'B', 'C', 'D']) expect(svg).toContain(`>${letter}<`);
    expect((await renderPng(svg)).length).toBeGreaterThan(0);
  });

  test('true/false has no letters', () => {
    const svg = triviaQuestionCard({ ...question, answers: ['True', 'False'] }, THEMES.dark);
    expect(svg).not.toContain('>A<');
    expect(svg).toContain('>True<');
  });
});

describe('triviaResultCard', () => {
  const result = { question: question.question, answers: question.answers, correct: 'Gold', picks: [1, 7, 0, 0] };

  test('fills the right answer, lists the quickest five with XP, and counts the rest', async () => {
    const winners = Array.from({ length: 7 }, (_, i) => ({ name: `M${i}`, xp: 30 - i }));
    const svg = triviaResultCard({ ...result, winners }, THEMES.dark);
    expect(svg).toContain('>1st<');
    expect(svg).toContain('>+30 XP<');
    expect(svg).toContain('>M4<');
    expect(svg).not.toContain('>M5<');
    expect(svg).toContain('+2 more got it right · 1 got it wrong');
    expect((await renderPng(svg)).length).toBeGreaterThan(0);
  });

  test('shows how long each winner took, and leaves it out when unknown', () => {
    const svg = triviaResultCard({ ...result, winners: [{ name: 'Quick', xp: 30, ms: 2340 }, { name: 'Old', xp: 20 }] }, THEMES.dark);
    expect(svg).toContain('>2.3 s<');
    expect(svg.match(/ s</g)).toHaveLength(1);
  });

  test('says so when nobody answered or nobody was right', () => {
    expect(triviaResultCard({ ...result, picks: [0, 0, 0, 0], winners: [] }, THEMES.dark)).toContain('Nobody answered!');
    expect(triviaResultCard({ ...result, picks: [2, 0, 1, 0], winners: [] }, THEMES.dark)).toContain('Nobody got it right (3 tried).');
  });
});

describe('GeoGuess cards', () => {
  // A 1×1 PNG: resvg must be able to draw the photo
  const image =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const answers = ['Belgium', 'France', 'Japan', 'Netherlands'];

  test('the question shows the photo and credits who took it, escaped', async () => {
    const svg = triviaQuestionCard({ ...question, category: 'GeoGuess', question: 'Which country is this?', answers, geo: { image, credit: 'a<b>' } }, THEMES.dark);
    expect(svg).toContain(`href="${image}"`);
    expect(svg).toContain('Photo by @a&lt;b&gt; on Mapillary · CC BY-SA 4.0');
    expect(svg).not.toContain('Open Trivia DB');
    expect((await renderPng(svg)).length).toBeGreaterThan(0);
  });

  test('the result names the country, marks the near misses and counts them apart from the wrong answers', async () => {
    const svg = triviaResultCard(
      { question: 'Which country is this?', answers, correct: 'Belgium', picks: [1, 2, 1, 1], winners: [{ name: 'A', xp: 30 }], geo: { image, near: ['France', 'Netherlands'] } },
      THEMES.dark
    );
    expect(svg).toContain('>It was Belgium<');
    expect(svg).toContain('>near · 2<');
    expect(svg).toContain('>near · 1<');
    expect(svg).toContain('3 near misses · 1 got it wrong');
    expect(svg).toContain('Photo on Mapillary · CC BY-SA 4.0');
    expect((await renderPng(svg)).length).toBeGreaterThan(0);
  });

  test('the scoreboard carries the game name', () => {
    expect(triviaScoreboardCard({ title: 'GeoGuess', rounds: 2, players: [] }, THEMES.dark)).toContain('GeoGuess · final scores after 2 rounds');
  });
});

describe('triviaScoreboardCard', () => {
  test('ranks every player with how many they got right and their XP', async () => {
    const svg = triviaScoreboardCard(
      { rounds: 5, players: [{ name: 'Top <1>', xp: 75, correct: 4 }, { name: 'Next', xp: 0, correct: 0 }] },
      THEMES.dark
    );
    expect(svg).toContain('final scores after 5 rounds');
    expect(svg).toContain('>Top &lt;1&gt;<');
    expect(svg).toContain('>4/5 right<');
    expect(svg).toContain('>+75 XP<');
    expect(svg).toContain('>2nd<');
    expect(svg).toContain('>0/5 right<');
    expect((await renderPng(svg)).length).toBeGreaterThan(0);
  });
});

describe('triviaStatsCard', () => {
  const stats = { answered: 14, correct: 11, firsts: 6, xp: 250, fastestMs: 1500, bestCategory: { name: 'History & <Art>', answered: 5, correct: 4 } };

  test('shows the tiles and the best category, escaped', async () => {
    const svg = triviaStatsCard({ name: 'Astolfo', serverName: 'Paladins', stats }, THEMES.dark);
    expect(svg).toContain('>79% of 14 answered<');
    expect(svg).toContain('>1.5 s<');
    expect(svg).toContain('Best category: History &amp; &lt;Art&gt;, 4 of 5 right');
    expect(svg).toContain('Trivia in Paladins');
    expect((await renderPng(svg)).length).toBeGreaterThan(0);
  });

  test('without a time or a best category it says so', () => {
    const svg = triviaStatsCard({ name: 'A', serverName: 'S', stats: { ...stats, fastestMs: undefined, bestCategory: undefined } }, THEMES.dark);
    expect(svg).toContain('>–<');
    expect(svg).toContain('not enough answers in one category yet');
  });
});

describe('ordinal', () => {
  test.each([[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [22, '22nd'], [111, '111th']])(
    '%i is %s',
    (n, word) => expect(ordinal(n)).toBe(word)
  );
});
