import { milestones, type Milestone } from "../../content/milestones";

/** The template's Release List sorts the Changelog CMS by Date, descending. Same-day entries fall back to version. */
export function sortedMilestones(): Milestone[] {
  return [...milestones].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return parseFloat(b.version) - parseFloat(a.version);
  });
}

export function findMilestone(slug: string) {
  return milestones.find((m) => m.slug === slug);
}
