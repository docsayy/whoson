import type { AcademicBlock } from "../types/block";

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function generateAcademicBlocks(params: {
  academicYear: string;
  firstBlockEndDate: string;
}): AcademicBlock[] {
  const startYear = Number(params.academicYear.split("-")[0]);

  const academicStart = new Date(startYear, 6, 1);
  const academicEnd = new Date(startYear + 1, 5, 30);

  const firstBlockEnd = new Date(params.firstBlockEndDate);

  const blocks: AcademicBlock[] = [];

  blocks.push({
    id: `${params.academicYear}-block-1`,
    academicYear: params.academicYear,
    blockNumber: 1,
    name: "Block 1",
    startDate: toDateInputValue(academicStart),
    endDate: toDateInputValue(firstBlockEnd),
  });

  let nextStart = addDays(firstBlockEnd, 1);
  let blockNumber = 2;

  while (nextStart <= academicEnd) {
    const proposedEnd = addDays(nextStart, 13);
    const actualEnd = proposedEnd > academicEnd ? academicEnd : proposedEnd;

    blocks.push({
      id: `${params.academicYear}-block-${blockNumber}`,
      academicYear: params.academicYear,
      blockNumber,
      name: `Block ${blockNumber}`,
      startDate: toDateInputValue(nextStart),
      endDate: toDateInputValue(actualEnd),
    });

    nextStart = addDays(actualEnd, 1);
    blockNumber++;
  }

  return blocks;
}