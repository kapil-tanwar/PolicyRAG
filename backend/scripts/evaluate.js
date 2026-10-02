import fs from 'fs';
import path from 'path';

// Evaluation Questions mapped to assessment requirements
const testQueries = [
    { type: 'Product', question: 'What are the main benefits of the premium health plan?' },
    { type: 'Policy', question: 'Can I cancel my insurance policy at any time?' },
    { type: 'Qualification', question: 'What is the minimum age to qualify for a business loan?' },
    { type: 'FAQ', question: 'How do I reset my password?' },
    { type: 'Objection', question: 'Why is the premium so expensive compared to others?' },
];

async function runEvaluation() {
    console.log('Starting RAG Evaluation...');
    const results = [];

    for (const test of testQueries) {
        console.log(`Testing [${test.type}] question: "${test.question}"`);
        
        try {
            const response = await fetch('http://localhost:5000/api/rag/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: test.question })
            });
            const data = await response.json();
            
            // Format sources
            const sourceRef = data.sources && data.sources.length > 0 
                ? data.sources.map(s => `${s.document} (chunk: ${s.chunk_id})`).join(', ')
                : 'None (Safe Fallback)';

            results.push(`
### Test: ${test.type}
**Question:** ${test.question}
**Retrieved Sources:** ${sourceRef}
**AI Answer:** ${data.answer}
**Relevance Explanation:** [TODO: Evaluator must fill this manually based on their ingested test data]
**Verdict:** [TODO: correct / partially correct / incorrect]
---`);

        } catch (error) {
            console.error(`Failed on query: ${test.question}`, error);
        }
    }

    const report = `# Question 2: Retrieval Evaluation Results\n\n${results.join('\n')}`;
    fs.writeFileSync('./evaluation_results.md', report);
    console.log('Evaluation complete! Check evaluation_results.md');
}

runEvaluation();
