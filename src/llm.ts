import OpenAI from 'openai';
import Groq from 'groq-sdk';

// 初始化 OpenAI 客户端
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL,
    dangerouslyAllowBrowser: true
});

// 初始化 Groq 客户端
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
    dangerouslyAllowBrowser: true
});

// 新增：初始化 Dify API 配置
const difyConfig = {
    apiKey: process.env.DIFY_API_KEY,
    reviewApiKey: process.env.DIFY_REVIEW_API_KEY,
    baseURL: process.env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1'
};

// 根据不同 LLM 服务处理 LLM 请求，并提取 JSON 数据
export async function handleLLMRequest(body: any): Promise<[string, any[]]> {
    let handler;
    switch (process.env.LLM_TYPE) {
        case 'local':
            handler = handleOllamaRequest;
            if (body.type === 'review') body.model = process.env.OLLAMA_REVIEW_MODEL;
            break;
        case 'groq':
            handler = handleGroqRequest;
            if (body.type === 'review') body.model = process.env.GROQ_REVIEW_MODEL;
            break;
        case 'dify':
            handler = handleDifyRequest;
            if (body.type === 'review') body.apiKey = process.env.DIFY_REVIEW_MODEL;
            break;
        default:
            handler = handleOpenAIRequest;
            if (body.type === 'review') body.model = process.env.OPENAI_REVIEW_MODEL;
    }
    const response = await handler(body);
    const jsonData = extractJsonFromResponse(response);
    return [response, jsonData];
}

// 处理 Ollama 请求。Ollama 安装后需要把 launchctl setenv OLLAMA_ORIGINS "*" 加入到 .bashrc 中
async function handleOllamaRequest(body: any): Promise<string> {
    const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: body.model || process.env.OLLAMA_MODEL,
            prompt: body.prompt,
            stream: false,
            temperature: 0.3,
            top_p: 0.9
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.response;
}

// 处理 OpenAI 请求
async function handleOpenAIRequest(body: any): Promise<string> {
    const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL,
        messages: [{ role: "user", content: body.prompt }],
        temperature: 0.3,
        top_p: 0.9
    });

    return completion.choices[0].message.content || '';
}

// 处理 Groq 请求
async function handleGroqRequest(body: any): Promise<string> {
    const completion = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
        messages: [{ role: "user", content: body.prompt }],
        temperature: 0.3,
        top_p: 0.9
    });

    return completion.choices[0].message.content || '';
}

// 新增：处理 Dify 请求
async function handleDifyRequest(body: any): Promise<string> {
    const response = await fetch(`${difyConfig.baseURL}/completion-messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${body.apiKey || difyConfig.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            inputs: {query: body.prompt},            // 可选的输入参数
            response_mode: 'blocking',           // 改为 streaming 模式
            user: body.user || 'default-user',    // 可选
        })
    });

    if (!response.ok) {
        throw new Error(`Dify API error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.answer || '';
}

// 新增：从响应文本中提取 JSON 数据
function extractJsonFromResponse(response: string): any[] {
    let jsonData: any[] = [];
    try {
        // 首先尝试直接解析整个响应
        try {
            const directParse = JSON.parse(response.trim());
            return Array.isArray(directParse) ? directParse : [directParse];
        } catch (e) {
            // 如果直接解析失败，继续尝试其他方法
        }

        // 尝试从响应中查找 JSON 代码块
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            const parsedData = JSON.parse(jsonMatch[1].trim());
            jsonData = Array.isArray(parsedData) ? parsedData : [parsedData];
        } else {
            // 尝试查找可能的 JSON 字符串（方括号或大括号开头和结尾）
            const jsonRegex = /(\[[\s\S]*\]|\{[\s\S]*\})/;
            const potentialJson = response.match(jsonRegex);
            if (potentialJson) {
                const parsedData = JSON.parse(potentialJson[1].trim());
                jsonData = Array.isArray(parsedData) ? parsedData : [parsedData];
            }
        }
    } catch (e) {
        console.warn('Failed to parse JSON from LLM response:', e);
    }
    return jsonData;
}
