import { retrieveRelevantChunks } from '../services/vectorDbService.js';
import { generateGroundedAnswer } from '../services/geminiService.js';

export async function queryRag(req, res) {
    try {
        const { question } = req.body;
        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        // Step 10: Retrieval
        const topChunks = await retrieveRelevantChunks(question, 3);
        
        if (!topChunks || topChunks.length === 0) {
            return res.status(200).json({
                answer: "I could not find sufficient information in the knowledge base to answer this question.",
                sources: []
            });
        }

        // Prepare context for LLM
        let context = "";
        const sources = [];
        
        topChunks.forEach((chunk, idx) => {
            context += `--- Document ${idx + 1} ---\nSource: ${chunk.title}\nCategory: ${chunk.category}\nContent:\n${chunk.content}\n\n`;
            
            // Step 12: Source tracking and Citations
            sources.push({
                document: chunk.title,
                record_id: chunk.record_id,
                chunk_id: chunk.id,
                category: chunk.category,
                distance: chunk.score
            });
        });

        // Step 11: RAG Generation (LLM grounded answer)
        const answer = await generateGroundedAnswer(question, context);

        return res.status(200).json({
            answer,
            sources,
            debug: {
                retrieved_chunks: topChunks.length,
                context_length: context.length
            }
        });

    } catch (error) {
        console.error('Error querying RAG system:', error);
        res.status(500).json({ error: 'Failed to process RAG query', details: error.message });
    }
}
