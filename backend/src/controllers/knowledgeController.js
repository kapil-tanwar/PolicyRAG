import { processDocument } from '../services/documentProcessor.js';
import { storeRecords } from '../services/vectorDbService.js';

export async function uploadDocument(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const category = req.body.category || 'general';
        
        // Step 1-8: Extract, Clean, PII, Chunk, Metadata
        const records = await processDocument(
            req.file.buffer, 
            req.file.mimetype, 
            req.file.originalname, 
            category
        );

        // Step 9: Embedding & Vector Storage
        await storeRecords(records);

        return res.status(200).json({ 
            message: 'Document processed successfully',
            chunks_created: records.length,
            sample_record: records[0]
        });

    } catch (error) {
        console.error('Error processing document:', error);
        res.status(500).json({ error: 'Failed to process document' });
    }
}
