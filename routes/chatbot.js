const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');

// Simulated Grok 3 response function (replace with actual xAI integration if available)
const getGrokResponse = async (message) => {
    console.log('📡 [getGrokResponse] Function called with message:', message);
    // This is a placeholder for actual response logic
    const reply = `Hello! You said: "${message}". How can I assist you with your travel plans today?`;
    console.log('✅ [getGrokResponse] Generated reply:', reply);
    return reply;
};

router.post('/', ensureAuthenticated, async (req, res) => {
    console.log('🚪 [POST /chatbot] Route hit');
    console.log('📥 [POST /chatbot] Request body:', req.body);
    console.log('👤 [POST /chatbot] Authenticated user:', req.user);

    try {
        const { message } = req.body;
        console.log('🔍 [POST /chatbot] Extracted message:', message);

        if (!message) {
            console.log('⚠ [POST /chatbot] Message is missing or empty');
            return res.status(400).json({ error: 'Message is required' });
        }

        // Get response from Grok 3 (simulated here)
        console.log('⏳ [POST /chatbot] Calling getGrokResponse...');
        const reply = await getGrokResponse(message);
        console.log('📤 [POST /chatbot] Sending reply:', reply);

        res.json({ reply });
        console.log('✅ [POST /chatbot] Response sent successfully');
    } catch (error) {
        console.error('🔥 [POST /chatbot] Error occurred:', error);
        res.status(500).json({ error: 'Failed to get response' });
        console.log('❌ [POST /chatbot] Error response sent');
    }
});

module.exports = router;