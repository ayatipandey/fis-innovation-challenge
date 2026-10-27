// Account rules shared by the sign-up form and the API.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '1234567890', 'qwertyuiop', 'iloveyou12', 'letmein123',
  'welcome123', 'admin12345', 'perkly1234', 'rewards123', 'abc1234567', 'qwerty1234',
]);

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 10 characters', test: (p: string) => p.length >= 10 && p.length <= 128 },
  { id: 'mix', label: 'At least one letter and one number', test: (p: string) => /[A-Za-z]/.test(p) && /\d/.test(p) },
  { id: 'common', label: 'Not a common password', test: (p: string) => p.length > 0 && !COMMON_PASSWORDS.has(p.toLowerCase()) },
] as const;

export function passwordProblems(password: string, email = ''): string[] {
  const problems: string[] = [];
  if (password.length < 10) problems.push('Use at least 10 characters.');
  if (password.length > 128) problems.push('Use 128 characters or fewer.');
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) problems.push('Include at least one letter and one number.');
  if (COMMON_PASSWORDS.has(password.toLowerCase())) problems.push('This password is too common. Choose something less predictable.');
  const local = email.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) problems.push('Don’t include the first part of your email in the password.');
  return problems;
}
