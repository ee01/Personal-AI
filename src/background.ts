console.log('Background script loaded');

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);

    if (request.type === 'OLLAMA_REQUEST') {
        const { body } = request.data;
        
        console.log('Sending request to Ollama:', body);
        
        // 403跨域的话要设置 launchctl setenv OLLAMA_ORIGINS "*"，或者编辑到 bash_profile 中重启不会失效 https://medium.com/dcoderai/how-to-handle-cors-settings-in-ollama-a-comprehensive-guide-ee2a5a1beef0
        fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: body.model,
                prompt: body.prompt,
                stream: body.stream,
                temperature: 0.3,
                top_p: 0.9
            })
        })
        .then(async response => {
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Response not ok:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText
                });
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const text = await response.text();
            console.log('Raw response:', text);
            
            try {
                const data = JSON.parse(text);
                console.log('Parsed response:', data);
                sendResponse({ data });
            } catch (e) {
                console.error('JSON parse error:', e);
                sendResponse({ 
                    error: 'Invalid JSON response from Ollama',
                    rawResponse: text 
                });
            }
        })
        .catch(error => {
            console.error('Ollama error:', error);
            sendResponse({ 
                error: error.message,
                details: 'Failed to connect to Ollama service'
            });
        });
        
        return true;
    }
}); 