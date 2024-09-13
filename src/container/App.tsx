import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { observer } from 'mobx-react';
import { Config } from './Config';
import { Stream } from './Stream';
import { ViewModel } from '../viewModel';

type IAppProps = {
    vm: ViewModel;
};

export const App = observer((props: IAppProps) => {
    const { vm } = props;
    const {
        lists,
        loading,
        showConfig,
        query,
        latestTimestamp,
        handleSetConfigConfig,
        handleSubmitQuery,
        handleClear
    } = vm;
    const hasResult = lists.length > 0;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { value } = e.target;
        vm.query = value;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && query.trim()) {
            handleSubmitQuery();
        }
    };

    const handleClose = () => {
        const container = document.querySelector('#radar-poc-container');
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
        const style = document.querySelector('#radar-poc-content-style');
        style.remove();
        const markdownStyle = document.querySelector('#radar-poc-markdown-style');
        markdownStyle.remove();
    };

    return (
        <div className="radar-poc-result" id="radar-poc-result">
            <div className="radar-poc-inner">
                <div className="radar-poc-header">
                    <h2>Radar PoC</h2>
                    <div className="radar-poc-header-right">
                        <button className="radar-poc-result-button" onClick={() => handleSetConfigConfig(!showConfig)}>{showConfig ? 'Open Panel' : 'Open Config'}</button>
                        {(hasResult && !showConfig) && <button className="radar-poc-result-close radar-poc-result-button" onClick={handleClear}>Clear Panel</button>}
                        <button className="radar-poc-result-close radar-poc-result-button" onClick={handleClose}>X</button>
                    </div>
                </div>
                <div className="radar-poc-result-main">
                    {/* @ts-ignore */}
                    {showConfig && <Config vm={vm} />}
                    {/* @ts-ignore */}
                    {!showConfig && <Stream vm={vm} />}
                </div>
               {(!showConfig && latestTimestamp) &&
               (<div className="radar-poc-footer">
                    <input type="text" value={query} onKeyDown={handleKeyDown} onChange={handleInputChange} placeholder="Please enter your question" />
                    <button className="radar-poc-result-button" onClick={handleSubmitQuery} disabled={!query.trim()}>Submit</button>
                </div>)}
            </div>
            {loading &&
            (<div className="loading-overlay">
                <div className="loading-spinner"></div>
            </div>)}
        </div>
    );
});