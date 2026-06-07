import { diffLines } from "diff";

export type Hunk = {
  before: string;
  after: string;
};

export function computeHunks(original: string, updated: string): Hunk[] {
  if (original === updated) return [];

  const changes = diffLines(original, updated);
  const hunks: Hunk[] = [];
  let i = 0;

  while (i < changes.length) {
    if (!changes[i].added && !changes[i].removed) {
      i++;
      continue;
    }

    let before = "";
    let after = "";

    while (i < changes.length && (changes[i].added || changes[i].removed)) {
      if (changes[i].removed) before += changes[i].value;
      else if (changes[i].added) after += changes[i].value;
      i++;
    }

    hunks.push({ before: before.trimEnd(), after: after.trimEnd() });
  }

  return hunks;
}
