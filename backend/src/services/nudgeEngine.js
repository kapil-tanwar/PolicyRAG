import { callGeminiWithFallback } from './geminiService.js';


// State per session (simple in-memory for prototype)
const sessions = {};

function initSession(socketId) {
    sessions[socketId] = {
        transcriptBuffer: [],
        cooldowns: {
            cross_sell: 0,
            compliance: 0
        },
        latencies: {
            llm: [],
            e2e: []
        },
        hasGivenCompliance: false
    };
}

// Calculate P50 and P95
function calculatePercentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
        return sorted[base];
    }
}

export function setupNudgeEngine(io) {
    io.on('connection', (socket) => {
        console.log('Agent Dashboard connected:', socket.id);
        initSession(socket.id);

        socket.on('transcript_chunk', async (data) => {
            const T1_received = Date.now();
            const { text, isAgent, timestamp: T0_audio } = data;
            
            const session = sessions[socket.id];
            if (!session) return;

            // Maintain rolling buffer (last 10 messages)
            session.transcriptBuffer.push(`${isAgent ? 'Agent' : 'Customer'}: ${text}`);
            if (session.transcriptBuffer.length > 10) {
                session.transcriptBuffer.shift();
            }

            // Simple compliance check (regex based for speed, or LLM)
            // If agent says "recorded", they met compliance.
            if (isAgent && text.toLowerCase().includes('record')) {
                session.hasGivenCompliance = true;
            }

            // Prepare LLM request
            const T2_llm_start = Date.now();
            const prompt = `
Analyze the following live call transcript chunk.
Look for exactly TWO signals:
1. "cross_sell": The CUSTOMER mentions something that implies they need an additional product (like a second vehicle, a business, a house).
2. "compliance_gap": If the AGENT has not mentioned that the call is recorded. Assume it is a gap UNLESS the agent explicitly says it.

Transcript Buffer:
${session.transcriptBuffer.join('\n')}

Output JSON STRICTLY matching this schema. Only include signals you find with high confidence (> 0.8).
{
  "signals": [
    {
      "type": "cross_sell" or "compliance_gap",
      "confidence": number between 0.0 and 1.0,
      "message": "The short nudge message to show the agent"
    }
  ]
}
`;

            try {
                const aiState = await callGeminiWithFallback(async (model) => {
                    const result = await model.generateContent(prompt);
                    return JSON.parse(result.response.text());
                }, { jsonMode: true });
                const T3_llm_end = Date.now();
                const llm_latency = T3_llm_end - T2_llm_start;
                session.latencies.llm.push(llm_latency);

                // Process Signals
                for (const signal of aiState.signals || []) {
                    if (signal.confidence >= 0.8) {
                        
                        // Enforce Compliance override (if regex already caught it, suppress LLM false positive)
                        if (signal.type === 'compliance_gap' && session.hasGivenCompliance) {
                            continue; // Suppress
                        }

                        // Enforce Cooldowns (e.g., 60 seconds)
                        const now = Date.now();
                        if (now - session.cooldowns[signal.type] < 60000) {
                            // Emitting a suppressed event for dashboard visibility
                            socket.emit('nudge_suppressed', { type: signal.type, reason: 'cooldown' });
                            continue;
                        }

                        // Emit Nudge
                        session.cooldowns[signal.type] = now;
                        const T4_delivery = Date.now();
                        const e2e_latency = T4_delivery - T0_audio;
                        session.latencies.e2e.push(e2e_latency);

                        socket.emit('new_nudge', {
                            signal: signal.type,
                            confidence: signal.confidence,
                            message: signal.message,
                            timestamp: new Date().toISOString(),
                            metrics: {
                                llm_latency_ms: llm_latency,
                                e2e_latency_ms: e2e_latency,
                                p50_e2e: calculatePercentile(session.latencies.e2e, 0.5).toFixed(0),
                                p95_e2e: calculatePercentile(session.latencies.e2e, 0.95).toFixed(0)
                            }
                        });
                    }
                }

            } catch (error) {
                console.error("Nudge Engine Error:", error);
            }
        });

        socket.on('disconnect', () => {
            delete sessions[socket.id];
        });
    });
}
