import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect, useRef } from 'react';

interface QueryResult {
    id: string;
    summary: string;
    details: string;
    reply_advice: string;
    timestamp: string;
    source: string;
    relevance: number;
    tags: string[];
    team?: {
        name: string;
        id: string;
        url: string;
    };
}

interface RecommendedQuestion {
    id: string;
    text: string;
    category: string;
}

const KnowledgeQuery = () => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<QueryResult[]>([]);
    const [recommendedQuestions, setRecommendedQuestions] = useState<RecommendedQuestion[]>([]);
    const [historyQueries, setHistoryQueries] = useState<string[]>([]);
    const [expandedResults, setExpandedResults] = useState<string[]>([]);
    const [conversationHistory, setConversationHistory] = useState<{question: string, answer: string}[]>([]);
    const [timeFilter, setTimeFilter] = useState<string>('all');
    const [isListening, setIsListening] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [filteredResults, setFilteredResults] = useState<QueryResult[]>([]);

    // 加载推荐问题和历史查询
    useEffect(() => {
        loadRecommendedQuestions();
        loadHistoryQueries();
    }, []);

    const loadRecommendedQuestions = async () => {
        try {
            // 这里应该从后端获取推荐问题
            // 模拟数据
            const mockRecommendedQuestions: RecommendedQuestion[] = [
                { id: '1', text: '我最近有什么待办事项？', category: '任务' },
                { id: '2', text: '公司的上下班制度是什么？', category: '规章制度' },
                { id: '3', text: '上周的项目进展如何？', category: '项目' },
                { id: '4', text: '下一次团队会议是什么时候？', category: '会议' }
            ];
            setRecommendedQuestions(mockRecommendedQuestions);
        } catch (error) {
            console.error('加载推荐问题失败:', error);
        }
    };

    const loadHistoryQueries = async () => {
        try {
            const result = await chrome.storage.local.get('historyQueries');
            if (result.historyQueries) {
                setHistoryQueries(result.historyQueries);
            }
        } catch (error) {
            console.error('加载历史查询失败:', error);
        }
    };

    const saveHistoryQuery = async (newQuery: string) => {
        try {
            // 避免重复
            if (historyQueries.includes(newQuery)) {
                const updatedHistory = [
                    newQuery,
                    ...historyQueries.filter(q => q !== newQuery)
                ].slice(0, 10); // 只保留最近10条
                
                await chrome.storage.local.set({ historyQueries: updatedHistory });
                setHistoryQueries(updatedHistory);
                return;
            }
            
            const updatedHistory = [newQuery, ...historyQueries].slice(0, 10);
            await chrome.storage.local.set({ historyQueries: updatedHistory });
            setHistoryQueries(updatedHistory);
        } catch (error) {
            console.error('保存历史查询失败:', error);
        }
    };

    const handleSearch = async () => {
        if (!query.trim()) return;
        
        setIsLoading(true);
        
        try {
            // 保存到历史查询
            await saveHistoryQuery(query);
            
            // 添加到对话历史
            const newConversationHistory = [...conversationHistory, { question: query, answer: '' }];
            setConversationHistory(newConversationHistory);
            
            // 调用后台脚本执行查询
            const response = await chrome.runtime.sendMessage({
                type: 'KNOWLEDGE_QUERY',
                question: query
            });
            
            // 构建提示信息
            const hintMessages = [];
            let answer = response.answer || '未找到相关信息';
            
            // 检查是否有人名模糊匹配
            if (response.entitiesByType && response.entitiesByType.topics) {
                const { topics, people, projects } = response.entitiesByType;
                
                // 添加人名提示
                if (people && people.length > 0) {
                    const peopleNames = people.map(p => p.name).join('、');
                    hintMessages.push(`相关人员: ${peopleNames}`);
                }
                
                // 添加项目提示
                if (projects && projects.length > 0) {
                    const projectsNames = projects.map(p => p.name).join('、');
                    hintMessages.push(`相关项目: ${projectsNames}`);
                }
                
                // 添加主题提示
                if (topics && topics.length > 0) {
                    const topicsNames = topics.map(t => t.name).join('、');
                    hintMessages.push(`相关主题: ${topicsNames}`);
                }
            }
            
            // 如果有提示信息，添加到回答前面
            if (hintMessages.length > 0) {
                answer = `(系统已识别${hintMessages.join('，')})\n\n${answer}`;
            }
            
            // 更新对话历史中的答案
            const updatedHistory = [...newConversationHistory];
            updatedHistory[updatedHistory.length - 1].answer = answer;
            setConversationHistory(updatedHistory);
            
            // 更新结果
            if (response.entitiesByType && response.entitiesByType.topics) {
                const { topics, people, projects } = response.entitiesByType;
                setResults(topics.map(t => ({
                    id: t.id,
                    summary: t.name,
                    details: t.description,
                    reply_advice: '',
                    timestamp: t.createdAt,
                    source: 'topic',
                    relevance: t.relevanceScore,
                    tags: t.tags,
                    team: {
                        name: t.name,
                        id: t.id,
                        url: t.url
                    }
                })));
            } else {
                setResults([]);
            }
        } catch (error) {
            console.error('查询失败:', error);
            // 更新对话历史中的错误信息
            const updatedHistory = [...conversationHistory];
            if (updatedHistory.length > 0) {
                updatedHistory[updatedHistory.length - 1].answer = '查询失败，请稍后再试';
                setConversationHistory(updatedHistory);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleQuestionClick = (question: string) => {
        setQuery(question);
        // 自动执行搜索
        setTimeout(() => {
            handleSearch();
        }, 100);
    };

    const toggleResultExpand = (resultId: string) => {
        if (expandedResults.includes(resultId)) {
            setExpandedResults(expandedResults.filter(id => id !== resultId));
        } else {
            setExpandedResults([...expandedResults, resultId]);
        }
    };

    const handleFeedback = (resultId: string, isHelpful: boolean) => {
        // 发送反馈到后端
        chrome.runtime.sendMessage({
            type: 'KNOWLEDGE_FEEDBACK',
            resultId,
            isHelpful
        });
        
        // 可以在UI上显示反馈已提交
        alert(isHelpful ? '感谢您的反馈！' : '感谢您的反馈，我们会继续改进');
    };

    const startVoiceInput = () => {
        if (!('webkitSpeechRecognition' in window)) {
            alert('您的浏览器不支持语音识别功能');
            return;
        }
        
        // @ts-ignore - 浏览器API
        const recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'zh-CN';
        
        recognition.onstart = () => {
            setIsListening(true);
        };
        
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setQuery(transcript);
        };
        
        recognition.onerror = (event: any) => {
            console.error('语音识别错误:', event.error);
            setIsListening(false);
        };
        
        recognition.onend = () => {
            setIsListening(false);
        };
        
        recognition.start();
    };

    const filterResultsByTime = (results: QueryResult[]) => {
        if (timeFilter === 'all') return results;
        
        const now = new Date();
        const oneDay = 24 * 60 * 60 * 1000;
        const oneWeek = 7 * oneDay;
        const oneMonth = 30 * oneDay;
        
        return results.filter(result => {
            const timestamp = new Date(result.timestamp).getTime();
            const diff = now.getTime() - timestamp;
            
            switch (timeFilter) {
                case 'today':
                    return diff < oneDay;
                case 'week':
                    return diff < oneWeek;
                case 'month':
                    return diff < oneMonth;
                default:
                    return true;
            }
        });
    };

    // 添加一个 useEffect 来监听 results 的变化
    useEffect(() => {
        // 当 results 更新时，计算过滤后的结果
        const filteredResults = filterResultsByTime(results);
        console.log('filteredResults', filteredResults, results);
        
        // 如果需要，可以将过滤后的结果保存到另一个状态中
        setFilteredResults(filteredResults);
    }, [results]); // 依赖于 results，当 results 变化时执行

    return (
        <div className="knowledge-query-container">
            <h1>知识库查询</h1>
            
            {/* 搜索框 */}
            <div className="search-container">
                <div className="search-input-wrapper">
                    <input
                        ref={searchInputRef}
                        type="text"
                        className="search-input"
                        placeholder="输入您的问题..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isLoading}
                    />
                    <button 
                        className={`voice-input-btn ${isListening ? 'listening' : ''}`}
                        onClick={startVoiceInput}
                        disabled={isLoading}
                    >
                        🎤
                    </button>
                </div>
                <button 
                    className="search-btn"
                    onClick={handleSearch}
                    disabled={isLoading}
                >
                    {isLoading ? '搜索中...' : '搜索'}
                </button>
            </div>
            
            {/* 推荐问题 */}
            <div className="recommended-questions">
                <h3>推荐问题</h3>
                <div className="question-tags">
                    {recommendedQuestions.map(question => (
                        <div 
                            key={question.id} 
                            className="question-tag"
                            onClick={() => handleQuestionClick(question.text)}
                        >
                            {question.text}
                        </div>
                    ))}
                </div>
            </div>
            
            {/* 历史查询 */}
            {historyQueries.length > 0 && (
                <div className="history-queries">
                    <h3>历史查询</h3>
                    <div className="query-history-list">
                        {historyQueries.map((historyQuery, index) => (
                            <div 
                                key={index} 
                                className="history-query-item"
                                onClick={() => handleQuestionClick(historyQuery)}
                            >
                                {historyQuery}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* 对话历史 */}
            {conversationHistory.length > 0 && (
                <div className="conversation-history">
                    <h3>对话历史</h3>
                    {conversationHistory.map((item, index) => (
                        <div key={index} className="conversation-item">
                            <div className="question">
                                <strong>问:</strong> {item.question}
                            </div>
                            {item.answer && (
                                <div className="answer">
                                    <strong>答:</strong> {item.answer.split('\n').map((line, i) => (
                                        <React.Fragment key={i}>
                                            {line}
                                            {i < item.answer.split('\n').length - 1 && <br />}
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            
            {/* 查询结果 */}
            {filteredResults.length > 0 && (
                <div className="query-results">
                    <div className="results-header">
                        <h3>关联信息</h3>
                        <div className="time-filter">
                            <select 
                                value={timeFilter}
                                onChange={(e) => setTimeFilter(e.target.value)}
                            >
                                <option value="all">所有时间</option>
                                <option value="today">今天</option>
                                <option value="week">本周</option>
                                <option value="month">本月</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="result-cards">
                        {filteredResults.map(result => (
                            <div key={result.id} className="result-card">
                                <div className="result-header">
                                    <h4>{result.summary}</h4>
                                    <span className="result-time">{new Date(result.timestamp).toLocaleString()}</span>
                                </div>
                                
                                <div className="result-summary">
                                    {result.details}
                                </div>
                                
                                {expandedResults.includes(result.id) && (
                                    <div className="result-details">
                                        <div className="result-reply_advice">
                                            <strong>回复建议:</strong> {result.reply_advice}
                                        </div>
                                        <div className="result-source">
                                            <strong>来源:</strong> {result.source}
                                        </div>
                                        {result.team && (
                                            <div className="result-team">
                                                <strong>群组:</strong> {result.team.url ? (
                                                    <a href={result.team.url} target="_blank" rel="noopener noreferrer">
                                                        {result.team.name}
                                                    </a>
                                                ) : (
                                                    result.team.name
                                                )}
                                            </div>
                                        )}
                                        <div className="result-tags">
                                            {result.tags.map((tag, idx) => (
                                                <span key={idx} className="result-tag">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="result-actions">
                                    <button 
                                        className="expand-btn"
                                        onClick={() => toggleResultExpand(result.id)}
                                    >
                                        {expandedResults.includes(result.id) ? '收起' : '展开'}
                                    </button>
                                    
                                    <div className="feedback-btns">
                                        <button 
                                            className="helpful-btn"
                                            onClick={() => handleFeedback(result.id, true)}
                                        >
                                            👍 有帮助
                                        </button>
                                        <button 
                                            className="not-helpful-btn"
                                            onClick={() => handleFeedback(result.id, false)}
                                        >
                                            👎 无帮助
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <style>{`
                .knowledge-query-container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                
                h1 {
                    text-align: center;
                    margin-bottom: 24px;
                    color: #333;
                }
                
                .search-container {
                    display: flex;
                    margin-bottom: 24px;
                }
                
                .search-input-wrapper {
                    position: relative;
                    flex: 1;
                }
                
                .search-input {
                    width: 91%;
                    padding: 12px 40px 12px 16px;
                    font-size: 16px;
                    border: 2px solid #ddd;
                    border-radius: 8px 0 0 8px;
                    outline: none;
                    transition: border-color 0.3s;
                }
                
                .search-input:focus {
                    border-color: #4a90e2;
                }
                
                .voice-input-btn {
                    position: absolute;
                    right: 8px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    opacity: 0.6;
                    transition: opacity 0.3s;
                }
                
                .voice-input-btn:hover {
                    opacity: 1;
                }
                
                .voice-input-btn.listening {
                    color: #f44336;
                    animation: pulse 1.5s infinite;
                }
                
                @keyframes pulse {
                    0% { opacity: 0.6; }
                    50% { opacity: 1; }
                    100% { opacity: 0.6; }
                }
                
                .search-btn {
                    padding: 0 24px;
                    background-color: #4a90e2;
                    color: white;
                    border: none;
                    border-radius: 0 8px 8px 0;
                    cursor: pointer;
                    font-size: 16px;
                    transition: background-color 0.3s;
                }
                
                .search-btn:hover {
                    background-color: #3a7bd5;
                }
                
                .search-btn:disabled {
                    background-color: #a0c3e8;
                    cursor: not-allowed;
                }
                
                .recommended-questions, .history-queries, .conversation-history, .query-results {
                    margin-bottom: 24px;
                    padding: 16px;
                    background-color: #f9f9f9;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                
                h3 {
                    margin-top: 0;
                    color: #333;
                    font-size: 18px;
                }
                
                .question-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                
                .question-tag {
                    background-color: #e1f0ff;
                    color: #4a90e2;
                    padding: 8px 16px;
                    border-radius: 16px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: background-color 0.3s;
                }
                
                .question-tag:hover {
                    background-color: #c5e1ff;
                }
                
                .query-history-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                
                .history-query-item {
                    background-color: #f0f0f0;
                    color: #666;
                    padding: 6px 12px;
                    border-radius: 16px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: background-color 0.3s;
                }
                
                .history-query-item:hover {
                    background-color: #e0e0e0;
                }
                
                .conversation-item {
                    margin-bottom: 16px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid #eee;
                }
                
                .conversation-item:last-child {
                    margin-bottom: 0;
                    padding-bottom: 0;
                    border-bottom: none;
                }
                
                .question, .answer {
                    margin-bottom: 8px;
                }
                
                .results-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }
                
                .time-filter select {
                    padding: 6px 12px;
                    border-radius: 4px;
                    border: 1px solid #ddd;
                }
                
                .result-cards {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                
                .result-card {
                    background-color: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    padding: 16px;
                    transition: box-shadow 0.3s;
                }
                
                .result-card:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
                
                .result-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }
                
                .result-header h4 {
                    margin: 0;
                    color: #333;
                }
                
                .result-time {
                    font-size: 12px;
                    color: #999;
                }
                
                .result-summary {
                    margin-bottom: 16px;
                    color: #555;
                }
                
                .result-summary-team {
                    margin-top: 8px;
                    font-size: 13px;
                    color: #666;
                }
                
                .team-label {
                    font-weight: 500;
                    margin-right: 4px;
                }
                
                .result-summary-team a {
                    color: #4a90e2;
                    text-decoration: none;
                    transition: color 0.3s;
                }
                
                .result-summary-team a:hover {
                    color: #3a7bd5;
                    text-decoration: underline;
                }
                
                .result-details {
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid #eee;
                }
                
                .result-source, .result-reply_advice {
                    margin-top: 8px;
                    font-size: 14px;
                    color: #666;
                }
                
                .result-team {
                    margin-top: 8px;
                    font-size: 14px;
                    color: #666;
                }
                
                .result-team a {
                    color: #4a90e2;
                    text-decoration: none;
                    transition: color 0.3s;
                }
                
                .result-team a:hover {
                    color: #3a7bd5;
                    text-decoration: underline;
                }
                
                .result-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 12px;
                }
                
                .result-tag {
                    background-color: #f0f0f0;
                    color: #666;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                }
                
                .result-actions {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 16px;
                }
                
                .expand-btn {
                    background-color: #f0f0f0;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background-color 0.3s;
                }
                
                .expand-btn:hover {
                    background-color: #e0e0e0;
                }
                
                .feedback-btns {
                    display: flex;
                    gap: 8px;
                }
                
                .helpful-btn, .not-helpful-btn {
                    background: none;
                    border: 1px solid #ddd;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .helpful-btn:hover {
                    background-color: #e8f5e9;
                    border-color: #81c784;
                }
                
                .not-helpful-btn:hover {
                    background-color: #ffebee;
                    border-color: #e57373;
                }
            `}</style>
        </div>
    );
};

ReactDOM.render(
    <KnowledgeQuery />,
    document.getElementById('knowledge-query-root')
); 