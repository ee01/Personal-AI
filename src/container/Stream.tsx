import * as React from 'react';
import { observer } from 'mobx-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ViewModel } from '../viewModel';


type IConfigProps = {
    vm: ViewModel;
};

export const Stream = observer((props: IConfigProps) => {
    const { vm } = props;
    const { 
        lists,
        candidateQuestions,
        latestTimestamp, 
        handleIncrement, 
        handleInitialize,
        handleGenerateReport,
        handleGenerateDisposeReport,
        handleCandidateQuestions,
    } = vm;
    const hasResult = lists.length > 0;

    return (
        <div className="radar-poc-chatbot">
            {!hasResult && <div className="radar-poc-config-section">
                <button className="radar-poc-result-button" onClick={handleInitialize}>GraphRAG Initialize</button>
                <button className="radar-poc-result-button" onClick={handleIncrement} disabled={!latestTimestamp}>GraphRAG Increment</button>
                <button className="radar-poc-result-button" onClick={handleGenerateReport} disabled={!latestTimestamp}>GraphRAG - Generate Report</button>
                <button className="radar-poc-result-button" onClick={handleGenerateDisposeReport}>[Full Context for Dify] - Generate Report</button>
            </div>}
            <div className="radar-poc-result-inner">
                {lists.map((text, index) => {
                    return  (<div key={index} className="radar-poc-result-item">
                                {/* @ts-ignore */}
                                <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
                            </div>
                        )
                })}
            </div>
            <div className="radar-poc-candidate">
                <ul className="radar-poc-candidate-ul">
                    {candidateQuestions.map((question, index) => (
                        <li onClick={() => handleCandidateQuestions(question)} key={index} className="radar-poc-candidate-li">
                            <span>{question}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
});