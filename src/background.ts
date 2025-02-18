import OpenAI from 'openai';

console.log('Background script loaded');

// 初始化 OpenAI 客户端
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL
});

// 处理 Ollama 请求
async function handleOllamaRequest(body: any) {
    const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: process.env.OLLAMA_MODEL,
            prompt: body.prompt,
            stream: false,
            temperature: 0.3,
            top_p: 0.9
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

// 处理 OpenAI 请求
async function handleOpenAIRequest(body: any) {
    const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL,
        messages: [{ role: "user", content: body.prompt }],
        temperature: 0.3,
        top_p: 0.9
    });

    return {
        response: completion.choices[0].message.content
    };
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);

    if (request.type === 'OLLAMA_REQUEST') {
        const { body } = request.data;
        
        console.log('Sending request to LLM:', body);
        
        // 根据配置选择不同的处理方式
        const handler = process.env.LLM_TYPE === 'local' ? handleOllamaRequest : handleOpenAIRequest;
        
        handler(body)
            .then(data => {
                console.log('LLM response:', data);
                sendResponse({ data });
            })
            .catch(error => {
                console.error('LLM error:', error);
                sendResponse({ 
                    error: error.message,
                    details: `Failed to connect to ${process.env.LLM_TYPE} service`
                });
            });
        
        return true;
    }
}); 