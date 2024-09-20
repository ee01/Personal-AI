import * as React from 'react';

type IActionsProps = {
    latestTimestamp?: number;
    showConfig: boolean;
    handleSaveConfig: () => void;
    handleInitialize: () => void;
    handleIncrement: () => void;
    handleGenerateReport: () => void;
    handleGenerateDisposeReport: () => void;
    handleDelete: () => void;
    handleTrendingTopics: () => void;
    handleGenerateGlobalSearchReport: () => void;
};

export const Actions = (props: IActionsProps) => {
    const {
        latestTimestamp,
        showConfig,
        handleSaveConfig,
        handleInitialize,
        handleIncrement,
        handleDelete,
        handleGenerateReport,
        handleGenerateDisposeReport,
        handleGenerateGlobalSearchReport,
        handleTrendingTopics,
    } = props;

    return (
        <div className="radar-poc-config-section">
            {showConfig && <button className="radar-poc-result-button" onClick={handleSaveConfig}>Save Configuration</button>}
            <button className="radar-poc-result-button" onClick={handleInitialize}>GraphRAG Initialize</button>
            <button className="radar-poc-result-button" onClick={handleIncrement} disabled={!latestTimestamp}>GraphRAG Increment</button>
            <button className="radar-poc-result-button" onClick={handleDelete} disabled={!latestTimestamp}>GraphRAG Delete All Indexing</button>
            <button className="radar-poc-result-button" onClick={handleGenerateReport} disabled={!latestTimestamp}>GraphRAG - Generate Report</button>
            <button className="radar-poc-result-button" onClick={handleGenerateGlobalSearchReport} disabled={!latestTimestamp}>GraphRAG - Generate Report(Use Global Search)</button>
            <button className="radar-poc-result-button" onClick={handleTrendingTopics} disabled={!latestTimestamp}>GraphRAG - Trending Topics</button>
            <button className="radar-poc-result-button" onClick={handleGenerateDisposeReport}>[Full Context for Dify] - Generate Report</button>
        </div>
    );
};