'use strict';

const { execFileSync } = require('node:child_process');

const BOT_AUTHOR = /\[bot\]|github-actions|classroom/i;
// Messages sans information : « update », « fix », « wip », « commit 3 », « . »…
const VAGUE = /^(update|updates|fix|fixes|wip|test|tests|commit|changes?|modif(ication)?s?|maj|ok|done|save|push|final|init|first commit|initial commit|add files? via upload|update [\w./-]+)\s*\d*\s*[.!]*$/i;

const run = (root, args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 });

// Commits de l'apprenant (null si le dossier n'est pas un dépôt git).
const loadCommits = (root) => {
  try {
    return run(root, ['log', '--no-merges', '--format=%H%x09%an%x09%ae%x09%ad%x09%s', '--date=format:%Y-%m-%d'])
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha, author, email, day, ...subject] = line.split('\t');
        return { sha, author, email, day, subject: subject.join('\t') };
      })
      .filter((c) => !BOT_AUTHOR.test(`${c.author} ${c.email}`));
  } catch {
    return null;
  }
};

const isExplicit = (subject) => {
  const text = subject.trim();
  return text.length >= 10 && !VAGUE.test(text) && /[a-zà-ÿ]{3,}.*\s+\S+/i.test(text);
};

// Commits de l'apprenant qui touchent l'évaluateur (dossier .github/).
const evaluatorTouched = (root) => {
  try {
    return run(root, ['log', '--no-merges', '--format=%an%x09%ae%x09%h%x09%s', '--', '.github'])
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split('\t'))
      .filter(([author, email]) => !BOT_AUTHOR.test(`${author} ${email}`))
      .map(([, , sha, subject]) => `${sha} ${subject}`);
  } catch {
    return [];
  }
};

const gitFacts = (root) => {
  const commits = loadCommits(root);
  if (!commits) return { available: false, count: 0, days: 0, explicitRatio: 0, vague: [], evaluatorTouched: [] };
  const days = new Set(commits.map((c) => c.day));
  const vague = commits.filter((c) => !isExplicit(c.subject));
  return {
    available: true,
    count: commits.length,
    days: days.size,
    explicitRatio: commits.length === 0 ? 0 : (commits.length - vague.length) / commits.length,
    vague: vague.slice(0, 3).map((c) => c.subject),
    evaluatorTouched: evaluatorTouched(root),
  };
};

const currentSha = (root) => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return run(root, ['rev-parse', '--short', 'HEAD']).trim();
  } catch {
    return 'n/a';
  }
};

module.exports = { gitFacts, currentSha, isExplicit };
