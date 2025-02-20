import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect } from 'react';

interface TopicItem {
    id: string;
    text: string;
    expiredAt: number;
}

const TopicModal = () => {
    const [topics, setTopics] = useState<TopicItem[]>([]);
    const [editingTopic, setEditingTopic] = useState<TopicItem | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTopic, setNewTopic] = useState('');
    const [newExpiry, setNewExpiry] = useState('7');

    useEffect(() => {
        loadTopics();
    }, []);

    const loadTopics = async () => {
        const result = await chrome.storage.local.get('concernedItems');
        if (result.concernedItems) {
            const topicsWithIds = result.concernedItems.map((topic: TopicItem) => ({
                ...topic,
                id: topic.id || Math.random().toString(36).substr(2, 9)
            }));
            setTopics(topicsWithIds);
        }
    };

    const saveTopics = async (newTopics: TopicItem[]) => {
        await chrome.storage.local.set({ concernedItems: newTopics });
        setTopics(newTopics);
    };

    const handleDelete = async (index: number) => {
        const newTopics = topics.filter((_, i) => i !== index);
        await saveTopics(newTopics);
    };

    const handleEdit = (topic: TopicItem) => {
        setEditingTopic(topic);
    };

    const handleSaveEdit = async () => {
        if (!editingTopic) return;
        
        const newTopics = topics.map(t => 
            t.id === editingTopic.id ? editingTopic : t
        );
        await saveTopics(newTopics);
        setEditingTopic(null);
    };

    const handleAdd = async () => {
        if (!newTopic) return;
        
        const newTopicItem: TopicItem = {
            id: Math.random().toString(36).substr(2, 9),
            text: newTopic,
            expiredAt: Date.now() + (parseInt(newExpiry) * 24 * 60 * 60 * 1000)
        };
        
        await saveTopics([...topics, newTopicItem]);
        setNewTopic('');
        setNewExpiry('7');
        setShowAddForm(false);
    };

    const getDaysRemaining = (expiredAt: number) => {
        const days = Math.ceil((expiredAt - Date.now()) / (1000 * 60 * 60 * 24));
        return days > 0 ? days : 0;
    };

    return (
        <div className="topic-modal">
            <h2>关注话题管理</h2>
            
            <div className="topic-list">
                {topics.map((topic) => (
                    <div key={topic.id} className="topic-item">
                        {editingTopic?.id === topic.id ? (
                            <div className="topic-edit-form">
                                <input
                                    value={editingTopic.text}
                                    onChange={e => setEditingTopic({
                                        ...editingTopic,
                                        text: e.target.value
                                    })}
                                />
                                <input
                                    type="number"
                                    value={Math.ceil((editingTopic.expiredAt - Date.now()) / (1000 * 60 * 60 * 24))}
                                    onChange={e => setEditingTopic({
                                        ...editingTopic,
                                        expiredAt: Date.now() + (parseInt(e.target.value) * 24 * 60 * 60 * 1000)
                                    })}
                                    min="1"
                                />
                                <button onClick={handleSaveEdit}>保存</button>
                                <button onClick={() => setEditingTopic(null)}>取消</button>
                            </div>
                        ) : (
                            <div className="topic-display">
                                <span className="topic-text">{topic.text}</span>
                                <span className="topic-expiry">
                                    还剩 {getDaysRemaining(topic.expiredAt)} 天
                                </span>
                                <button onClick={() => handleEdit(topic)}>✏️</button>
                                <button onClick={() => handleDelete(topics.indexOf(topic))}>🗑️</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {showAddForm ? (
                <div className="add-topic-form">
                    <input
                        placeholder="输入关注话题"
                        value={newTopic}
                        onChange={e => setNewTopic(e.target.value)}
                    />
                    <input
                        type="number"
                        value={newExpiry}
                        onChange={e => setNewExpiry(e.target.value)}
                        min="1"
                        placeholder="过期天数"
                    />
                    <button onClick={handleAdd}>确认</button>
                    <button onClick={() => setShowAddForm(false)}>取消</button>
                </div>
            ) : (
                <button onClick={() => setShowAddForm(true)}>新增关注项</button>
            )}

            <style>{`
                .topic-modal {
                    padding: 16px;
                }
                
                .topic-list {
                    margin-bottom: 16px;
                }
                
                .topic-item {
                    display: flex;
                    padding: 8px;
                    border-bottom: 1px solid #eee;
                }
                
                .topic-display {
                    display: flex;
                    width: 100%;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .topic-edit-form {
                    display: flex;
                    gap: 8px;
                    width: 100%;
                }
                
                .topic-text {
                    flex: 1;
                }
                
                .topic-expiry {
                    margin: 0 16px;
                    color: #666;
                }
                
                button {
                    margin: 0 4px;
                    padding: 4px 8px;
                    cursor: pointer;
                }
                
                input {
                    padding: 4px 8px;
                }
                
                .add-topic-form {
                    display: flex;
                    gap: 8px;
                    margin-top: 16px;
                }
            `}</style>
        </div>
    );
};

ReactDOM.render(
    <TopicModal />,
    document.getElementById('topic-modal-root')
); 