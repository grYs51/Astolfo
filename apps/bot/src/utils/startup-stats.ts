import { execFileSync } from 'child_process';

// Deploy runs from a git checkout; a Docker image has no .git, hence the fallback
const readCommit = () => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
};

/** Facts about this run for the admin page, filled in by index.ts at startup. */
export const startupStats = {
  commit: readCommit(),
  danglingVoiceSessions: 0,
  danglingStatuses: 0,
};
