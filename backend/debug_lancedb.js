import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'data/vectordb');

async function test() {
    const db = await lancedb.connect(dbPath);
    const table = await db.openTable('knowledge_base');
    const results = await table.search(Array(768).fill(0)).limit(1).execute();
    console.log("Type of results:", typeof results);
    console.log("Is Array?", Array.isArray(results));
    console.log("Keys:", Object.keys(results));
    console.log("Results directly:", results);
}
test();
