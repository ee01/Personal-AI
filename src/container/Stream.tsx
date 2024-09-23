import * as React from 'react';
import { observer } from 'mobx-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ViewModel } from '../viewModel';
import { formatDate } from '../utils';
import { Actions } from './Actions';


type IConfigProps = {
    vm: ViewModel;
};

export const Stream = observer((props: IConfigProps) => {
    const { vm } = props;
    const { 
        lists,
        radarPoCConfig,
        candidateQuestions,
        handleSaveConfig,
        latestTimestamp, 
        handleIncrement, 
        handleInitialize,
        handleGenerateReport,
        handleGenerateDisposeReport,
        handleCandidateQuestions,
        handleDelete,
        handleTrendingTopics,
        handleGenerateGlobalSearchReport,
        handleGenerateSalesReport,
        handleDeleteItem
    } = vm;
    const hasResult = lists.length > 0;
    const enableCandidateQuestions = radarPoCConfig.config.enableCandidateQuestions;

    return (
        <div className="radar-poc-chatbot">
            {!hasResult && <Actions
                    handleTrendingTopics={handleTrendingTopics}
                    handleSaveConfig={handleSaveConfig} 
                    handleInitialize={handleInitialize} 
                    handleIncrement={handleIncrement}
                    handleGenerateReport={handleGenerateReport}
                    handleGenerateDisposeReport={handleGenerateDisposeReport}
                    handleDelete={handleDelete}
                    handleGenerateGlobalSearchReport={handleGenerateGlobalSearchReport}
                    handleGenerateSalesReport={handleGenerateSalesReport}
                    latestTimestamp={latestTimestamp}
                    showConfig={false}
                />}
            <div className="radar-poc-result-inner">
                {lists.map((item, index) => {
                    return  (
                    <div key={item.id} className="radar-poc-result-item-wrapper">
                        <span className='radar-poc-result-item-time'>Generate Time: {formatDate(item.timestamp)} <i onClick={() => handleDeleteItem(item.id)}>Delete</i></span>
                        <div key={index} className="radar-poc-result-item">
                            <Markdown remarkPlugins={[remarkGfm]}>{item.text}</Markdown>
                        </div>
                    </div>
                    )
                })}
            </div>
            {enableCandidateQuestions && <div className="radar-poc-candidate">
                <ul className="radar-poc-candidate-ul">
                    {candidateQuestions.map((question, index) => (
                        <li onClick={() => handleCandidateQuestions(question)} key={index} className="radar-poc-candidate-li">
                            <span>{question}</span>
                        </li>
                    ))}
                </ul>
            </div>}
        </div>
    );
});