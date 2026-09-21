import { open, link, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// Fully flushed, immutable review files; no civic staging pointer is modified.
export async function saveDivulgaReview(output, review) {
  const temporary = output + '.' + randomUUID() + '.tmp';
  let created = false;
  try {
    const file = await open(temporary,'wx'); created = true;
    try { await file.writeFile(JSON.stringify(review,null,2)+'\n','utf8'); await file.sync(); }
    finally { await file.close(); }
    await link(temporary,output); // exclusive: an earlier review is never replaced
  } finally { if (created) await unlink(temporary); }
}
