import { goodbyePost, welcomePost } from './member-messages';

describe('welcomePost', () => {
  test('puts the mention in place of every @member', () => {
    expect(welcomePost('Hi @member! Say hi, @member', '42').content).toBe(
      'Hi <@42>! Say hi, <@42>'
    );
  });

  test('an empty message falls back to Welcome @member', () => {
    expect(welcomePost('', '42').content).toBe('Welcome <@42>');
  });

  test('only the new member can be pinged', () => {
    expect(welcomePost('@everyone meet @member', '42').allowedMentions).toEqual({
      users: ['42'],
    });
  });
});

describe('goodbyePost', () => {
  test('uses the escaped display name, literally', () => {
    expect(goodbyePost('Bye @member', '*star* $&')?.content).toBe(String.raw`Bye \*star\* $&`);
  });

  test('pings nobody', () => {
    expect(goodbyePost('@everyone @member left', 'x')?.allowedMentions).toEqual({ parse: [] });
  });

  test('an empty message means no goodbye', () => {
    expect(goodbyePost('', 'x')).toBeUndefined();
  });
});
