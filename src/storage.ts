export function getIndexedDBData(databaseName: string, storeName: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName);
    
        request.onsuccess = (event: any) => {
            const db = event.target.result;
            const transaction = db.transaction([storeName], 'readonly');
            const objectStore = transaction.objectStore(storeName);
            const dataRequest = objectStore.getAll();
    
            dataRequest.onsuccess = (event: any) => {
            resolve(event.target.result);
            };
    
            dataRequest.onerror = (event: any) => {
            reject(event.target.error);
            };
        };
    
        request.onerror = (event: any) => {
            reject(event.target.error);
        };
    });
}


export const getLocalStorageItem = (key: string, defaultValue: any) => {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(defaultValue));
};

export const setLocalStorageItem = (key: string, defaultValue: any) => {
    localStorage.setItem(key, JSON.stringify(defaultValue));
};

export function getCurrentUserInfo() {
    const { extension: extensionId } = getLocalStorageItem('ownExtension', {});
    const username = getLocalStorageItem('displayName', 'radar-poc');
    
    return {
        extensionId,
        username
    };
}

export function getFolders() {
    return getIndexedDBData('Glip', 'profile').then(([data]) => {
        // @ts-ignore
        const folders = [{title: ' ', ids: []},{title: 'favorite', ids: data.favorite_group_ids}, ...data.conversation_sets.filter(item => item.type === 'folder')]
            return folders;
        }).catch(error => {
          console.log(error);
        });
}