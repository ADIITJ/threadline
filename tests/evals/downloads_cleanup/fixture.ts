export const sampleFiles = [
  { name: "invoice-march-2024.pdf", ageDays: 45, sizeBytes: 1024 * 200 },
  { name: "screenshot-2024-01-05.png", ageDays: 72, sizeBytes: 1024 * 500 },
  { name: "zoom-recording.mp4", ageDays: 30, sizeBytes: 1024 * 1024 * 50 },
  { name: "recent-doc.docx", ageDays: 1, sizeBytes: 1024 * 30 },
];

export const CLEANUP_THRESHOLD_DAYS = 3;

export const expectedCandidates = sampleFiles.filter((f) => f.ageDays > CLEANUP_THRESHOLD_DAYS);
