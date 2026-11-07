import { afterAll } from 'vitest';
import { closeDb } from '../db/index.js';

// Every test file uses an isolated in-memory database. Close the connection
// after the file so better-sqlite3 releases the memory and file handles.
afterAll(() => {
  closeDb();
});
