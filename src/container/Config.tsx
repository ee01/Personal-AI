import * as React from 'react';
import { observer } from 'mobx-react';
import { formatDate } from '../utils';
import { ViewModel } from '../viewModel';
import { Actions } from './Actions';

type IConfigProps = {
    vm: ViewModel;
};

export const Config = observer((props: IConfigProps) => {
    const { vm } = props;
    const { 
        radarPoCConfig, 
        latestTimestamp, 
        folders,
        handleSaveConfig, 
        handleIncrement, 
        handleInitialize,
        handleGenerateReport,
        handleGenerateDisposeReport,
        handleDelete
    } = vm;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        radarPoCConfig.updateConfig({
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        });
    };

    return (
        <div className="radar-poc-config">
            <div className="radar-poc-config-wrapper">   
                <div className="radar-poc-config-section">
                    <label htmlFor="recentDays">Days of data (max: past 7d)</label>
                    <input
                        type="number"
                        name="recentDays"
                        max="7"
                        min="0"
                        value={radarPoCConfig.config.recentDays}
                        onChange={handleInputChange}
                    />
                </div>
                <div className="radar-poc-config-section">
                    <label htmlFor="model">LLM model</label>
                    <select
                        name="model"
                        value={radarPoCConfig.config.model}
                        onChange={handleInputChange}
                    >
                        <option value="4o">4o</option>
                        <option value="4o-mini">4o mini</option>
                    </select>
                </div>
            
                <div className="radar-poc-config-section">
                    <label htmlFor="apiKey">API key <a href="https://lop2-dev.int.rclabenv.com/app/1199ad4f-1fc8-4053-869c-19179de930d0/configuration">default</a></label>
                    <input
                        type="text"
                        name="apiKey"
                        value={radarPoCConfig.config.apiKey}
                        onChange={handleInputChange}
                    />
                </div>
            
                <div className="radar-poc-config-section">
                    <label>Data source</label>
                    <div className="radar-poc-config-dataSource">
                        {['Message', 'Sms', 'Voicemail', 'CallTranscript', 'Calendar'].map(source => (
                            <span key={source}>
                                <input
                                    type="checkbox"
                                    name={`enable${source}`}
                                    // @ts-ignore
                                    checked={radarPoCConfig.config[`enable${source}`]}
                                    onChange={handleInputChange}
                                /> {source}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="radar-poc-config-section">
                    <label htmlFor="selectGroupNames">Select group, separated by commas (default all)</label>
                    <input
                        type="text"
                        name="selectGroupNames"
                        placeholder="e.g: team1,team2"
                        value={radarPoCConfig.config.selectGroupNames}
                        onChange={handleInputChange}
                    />
                    <label htmlFor="selectFolderGroupIds">Choose a folder:</label>
                    <select
                        name="selectFolderGroupIds"
                        value={radarPoCConfig.config.selectFolderGroupIds}
                        onChange={handleInputChange}
                    >
                        {folders.map((folder, index) => (
                            <option key={index} value={folder.ids}>{folder.title}</option>
                        ))}
                    </select>
                </div>
                {Boolean(latestTimestamp) && <p className="radar-poc-config-tip">Last indexing time: {formatDate(latestTimestamp)}</p>}
                <Actions
                    handleSaveConfig={handleSaveConfig} 
                    handleInitialize={handleInitialize} 
                    handleIncrement={handleIncrement}
                    handleGenerateReport={handleGenerateReport}
                    handleGenerateDisposeReport={handleGenerateDisposeReport}
                    handleDelete={handleDelete}
                    latestTimestamp={latestTimestamp}
                    showConfig={true}
                />
            </div>
        </div>
    );
});