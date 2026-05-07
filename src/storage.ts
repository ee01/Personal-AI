export function getIndexedDBData(databaseName: string, storeName: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName);
    
        request.onsuccess = (event: any) => {
            try {
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
            } catch (error) {
                reject(error);
            }
        };
    
        request.onerror = (event: any) => {
            reject(event.target.error);
        };
    });
}

/**
 * 根据 ID 从 IndexedDB 获取单条记录
 * @param databaseName 数据库名称
 * @param storeName 存储表名称
 * @param id 记录 ID
 */
export function getIndexedDBDataById(databaseName: string, storeName: string, id: string | number): Promise<any> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName);
    
        request.onsuccess = (event: any) => {
            try {
                const db = event.target.result;
                const transaction = db.transaction([storeName], 'readonly');
                const objectStore = transaction.objectStore(storeName);
                const dataRequest = objectStore.get(id);
        
                dataRequest.onsuccess = (event: any) => {
                    resolve(event.target.result);
                };
        
                dataRequest.onerror = (event: any) => {
                    reject(event.target.error);
                };
            } catch (error) {
                reject(error);
            }
        };
    
        request.onerror = (event: any) => {
            reject(event.target.error);
        };
    });
}

/**
 * 根据多个 ID 从 IndexedDB 批量获取记录
 * @param databaseName 数据库名称
 * @param storeName 存储表名称
 * @param ids 记录 ID 数组
 */
export function getIndexedDBDataByIds(databaseName: string, storeName: string, ids: (string | number)[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName);
    
        request.onsuccess = (event: any) => {
            try {
                const db = event.target.result;
                const transaction = db.transaction([storeName], 'readonly');
                const objectStore = transaction.objectStore(storeName);
                
                const results: any[] = [];
                let completed = 0;
                
                if (ids.length === 0) {
                    resolve([]);
                    return;
                }
                
                ids.forEach((id) => {
                    const dataRequest = objectStore.get(id);
                    
                    dataRequest.onsuccess = (event: any) => {
                        if (event.target.result) {
                            results.push(event.target.result);
                        }
                        completed++;
                        if (completed === ids.length) {
                            resolve(results);
                        }
                    };
                    
                    dataRequest.onerror = () => {
                        completed++;
                        if (completed === ids.length) {
                            resolve(results);
                        }
                    };
                });
            } catch (error) {
                reject(error);
            }
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
            const favorite_group_ids = data?.favorite_group_ids || [];
            const conversation_sets = data?.conversation_sets || [];
            // @ts-ignore
            const folders = [{title: ' ', ids: []},{title: 'favorite', ids: favorite_group_ids}, ...conversation_sets.filter(item => item.type === 'folder')]
            return folders;
        }).catch(error => {
          console.log(error);
        });
}

export function getGroupsMap() {
    return getIndexedDBData('Glip', 'group').then((groups) => {
        const groupsMap = groups.reduce((acc: any, group: any) => {
            acc[group.id] = {
                name: group.set_abbreviation,
                is_team: group.is_team
            };
            return acc;
        }, {});

        return groupsMap;
    });
}
