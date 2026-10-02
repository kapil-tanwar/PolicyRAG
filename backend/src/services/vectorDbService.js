import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getEmbedding } from './geminiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../data/vectordb');

// Ensure directory exists
if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
}

let db = null;
const TABLE_NAME = 'knowledge_base';

async function getDb() {
    if (!db) {
        db = await lancedb.connect(dbPath);
    }
    return db;
}

/**
 * Embeds and stores chunks in the Vector DB
 */
export async function storeRecords(records) {
    const database = await getDb();
    
    // We need to embed the content of each record
    console.log(`Embedding ${records.length} chunks...`);
    const dataToInsert = [];
    
    for (const record of records) {
        // Simple rate limiting avoidance if needed, but Gemini handles small bursts ok
        const vector = await getEmbedding(record.content);
        dataToInsert.push({
            id: record.id,
            vector: vector,
            record_id: record.record_id,
            title: record.title,
            content: record.content,
            category: record.category,
            source: record.source,
            version: record.version,
            pii: record.pii
        });
    }

    const tableNames = await database.tableNames();
    
    if (tableNames.includes(TABLE_NAME)) {
        // Table exists, append data
        const table = await database.openTable(TABLE_NAME);
        await table.add(dataToInsert);
    } else {
        // Create new table
        await database.createTable(TABLE_NAME, dataToInsert);
    }
    
    console.log(`Successfully stored ${records.length} chunks in LanceDB.`);
}

/**
 * Retrieves the most relevant chunks for a given query
 */
export async function retrieveRelevantChunks(queryText, topK = 5) {
    const database = await getDb();
    const tableNames = await database.tableNames();
    
    if (!tableNames.includes(TABLE_NAME)) {
        console.warn("Knowledge base is empty. Please upload documents first.");
        return [];
    }

    const table = await database.openTable(TABLE_NAME);
    
    console.log(`Embedding query: "${queryText}"`);
    const queryVector = await getEmbedding(queryText);
    
    console.log("Searching vector database...");
    const results = await table.search(queryVector).limit(topK).toArray();
    
    // LanceDB returns a flat array of matches with distance scores
    return results.map(r => ({
        id: r.id,
        record_id: r.record_id,
        title: r.title,
        content: r.content,
        category: r.category,
        source: r.source,
        score: r._distance // Typically lower distance means higher similarity in LanceDB (L2 or Cosine depending on metric)
    }));
}
