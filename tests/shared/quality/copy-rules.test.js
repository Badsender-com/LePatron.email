'use strict';

const {
  inboxLength,
  inboxStart,
  fakeReplyPrefix,
  repeatsSubject,
} = require('../../../packages/shared/quality/copy-rules.js');

describe('inboxLength', () => {
  it.each([
    ['Spring sale', 11],
    ['Hi {{first_name}}', 2],
    ['Hi {% if x %}you{% endif %}', 6],
    ['<%= recipient.firstName %>, hello', 7],
    ['Our nurses 👩‍⚕️', 12],
    ['  two   spaces  ', 10],
  ])('counts "%s" as %i', (text, length) => {
    expect(inboxLength(text)).toBe(length);
  });

  it('counts an accent typed as two code points as one character', () => {
    expect(inboxLength('été')).toBe(3);
  });
});

describe('inboxStart', () => {
  it('cuts the text inboxLength counts: tags out, one emoji one character', () => {
    expect(inboxStart('Hi {{first_name}}, our sale', 9)).toBe('Hi , our ');
    expect(inboxStart('👩‍⚕️ thank you', 3)).toBe('👩‍⚕️ t');
  });

  it('gives the whole text when it is shorter', () => {
    expect(inboxStart('Sale', 35)).toBe('Sale');
  });
});

describe('fakeReplyPrefix', () => {
  it.each([
    ['RE: your order', 'RE:'],
    ['TR : notre offre', 'TR :'],
    ['FWD:Important', 'FWD:'],
    ['Re[2]: your order', 'Re[2]:'],
    ['RE： votre commande', 'RE：'],
    ['  Fwd : the plan', 'Fwd :'],
  ])('reads "%s" as faking %s', (subject, prefix) => {
    expect(fakeReplyPrefix(subject)).toBe(prefix);
  });

  it.each(['Re:Think different', 're:boot your routine', 'Reply now', ''])(
    'reads no prefix in "%s"',
    (subject) => {
      expect(fakeReplyPrefix(subject)).toBeNull();
    }
  );
});

describe('repeatsSubject', () => {
  it.each([
    ['Spring sale', 'Spring sale'],
    ['« Spring sale ! »', 'spring sale 🔥'],
    ['Spring sale: 30% off everything', 'Spring sale'],
    ['{{first_name}}, spring sale', 'Spring sale'],
  ])('reads "%s" as repeating "%s"', (preheader, subject) => {
    expect(repeatsSubject(preheader, subject)).toBe(true);
  });

  it.each([
    ['New arrivals this week', 'New'],
    ['Salesforce days', 'Sale days'],
    ['30% off everything', 'Spring sale'],
  ])('reads "%s" as not repeating "%s"', (preheader, subject) => {
    expect(repeatsSubject(preheader, subject)).toBe(false);
  });
});
