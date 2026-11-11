import { renderPng } from './render';
import { ordinal, triviaQuestionCard, triviaResultCard, triviaScoreboardCard, wrap } from './trivia.card';
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

describe('ordinal', () => {
  test.each([[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [22, '22nd'], [111, '111th']])(
    '%i is %s',
    (n, word) => expect(ordinal(n)).toBe(word)
  );
});
