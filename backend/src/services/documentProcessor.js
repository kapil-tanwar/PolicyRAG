import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { v4 as uuidv4 } from 'uuid';

/**
 * Extracts text from a file buffer
 */
export async function extractText(fileBuffer, mimetype) {
    if (mimetype === 'application/pdf') {
        const data = await pdfParse(fileBuffer);
        return data.text;
    } else {
        // Assume text file for other types
        return fileBuffer.toString('utf-8');
    }
}

/**
 * Cleans the extracted text and standardizes it.
 * Removes excess whitespace, simple headers/footers.
 */
export function cleanText(text) {
    let cleaned = text;
    // Remove repeated newlines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    // Remove common navigation/footer text (example)
    cleaned = cleaned.replace(/Page \d+ of \d+/g, '');
    cleaned = cleaned.replace(/Copyright © \d{4}.*/g, '');
    // Standardize spacing
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    return cleaned.trim();
}

/**
 * Basic PII protection using Regex
 * Masks Emails and Phone numbers
 */
export function protectPII(text) {
    let protectedText = text;
    // Mask emails
    protectedText = protectedText.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
    // Mask US phone numbers
    protectedText = protectedText.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');
    // Mask SSN
    protectedText = protectedText.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]');
    
    const piiFound = protectedText !== text;
    return { text: protectedText, hasPii: piiFound };
}

/**
 * Chunks text into smaller pieces with overlap
 */
export function chunkText(text, maxChars = 1000, overlapChars = 200) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        let end = i + maxChars;
        // Try not to break in the middle of a word/sentence
        if (end < text.length) {
            const nextSpace = text.indexOf(' ', end);
            const prevSpace = text.lastIndexOf(' ', end);
            if (prevSpace > i + (maxChars / 2)) {
                end = prevSpace; // Break at previous space if reasonable
            } else if (nextSpace !== -1) {
                end = nextSpace; // Break at next space
            }
        }
        
        chunks.push(text.slice(i, end).trim());
        i = end - overlapChars;
        if (i <= 0) break; // prevent infinite loops if overlap is weird
    }
    return chunks;
}

/**
 * Main ingestion pipeline combining all steps
 */
export async function processDocument(fileBuffer, mimetype, originalName, category = 'general') {
    // 1. Extraction
    const rawText = await extractText(fileBuffer, mimetype);
    
    // 2. Cleaning
    const cleanedText = cleanText(rawText);
    
    // 3. PII Protection
    const { text: safeText, hasPii } = protectPII(cleanedText);
    
    // 4. Chunking
    const chunks = chunkText(safeText, 800, 150);
    
    // 5. Metadata Creation
    const recordId = uuidv4();
    const records = chunks.map((chunk, index) => ({
        id: `${recordId}_chunk_${index}`,
        record_id: recordId,
        title: originalName,
        content: chunk,
        category: category,
        source: originalName,
        version: "1.0",
        pii: hasPii
    }));

    return records;
}
