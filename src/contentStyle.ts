export const CONTENT_STYLE = `
.radar-poc-toast {
    position: absolute;
    top: 32px;
    left: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    width: 240px;
    justify-content: space-between;
    z-index: 1000;
    padding: 16px 20px;
    word-break: break-word;
    border-radius: 0px;
    font-weight: 400;
    border-radius: 4px;
    opacity: 0.9;
}
.radar-poc-toast-success {
  background-color: rgb(240, 252, 239);
  color: rgb(50, 119, 59);
}
.radar-poc-toast-error {
  background-color: rgb(255, 247, 245);
  color: rgb(190, 57, 51);
}
.radar-poc-toast-info {
  background-color: rgb(243, 243, 243);
  color: rgb(18, 18, 18);
}

.radar-poc-result-button {
  color: rgb(6, 111, 172);
  border: 1px solid rgb(6, 111, 172);
  padding: 0px 10px;
  text-transform: none;
  text-align: center;
  box-shadow: unset;
  border-radius: 4px;
  min-height: 32px;
  background-color: transparent;
  cursor: pointer;
}

.radar-poc-result-button:hover {
  background-color: rgba(6, 111, 172, 0.08);
}

.radar-poc-result-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.radar-poc-config-section .radar-poc-result-button {
  min-height: 36px;
}

.radar-poc-config-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radar-poc-config-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.radar-poc-config-section label {
  margin-bottom: 5px;
}

.radar-poc-config-section input[type="text"],
.radar-poc-config-section input[type="number"],
.radar-poc-config-section select {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.radar-poc-config-dataSource {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.radar-poc-config-dataSource span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.radar-poc-config-tip {
  font-style: italic;
  color: #666;
  margin: 0;
}

.radar-poc-config a {
  color: #0066cc;
  text-decoration: none;
}

.radar-poc-config a:hover {
  text-decoration: underline;
}
.radar-poc-result {
    position: relative;
    width: 450px;
    min-width: 450px;
    height: 100%;
    box-sizing: border-box;
    background: linear-gradient(135deg, rgba(235, 115, 197, 0.08) 4.17%, rgba(136, 114, 239, 0.08) 54.17%, rgba(103, 140, 240, 0.08) 100%);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    padding: 16px;
    border-right: 1px solid rgb(243, 243, 243);
    overflow-y: auto;
}
.radar-poc-result-item {
    margin-bottom: 18px;
    border: 1px solid #e1e4e8;
    padding: 6px;
    border-radius: 4px;
}
.radar-poc-inner {
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    width: 100%;
    height: 100%;
    background: #fff;
    box-shadow: 0px 2px 4px -1px rgba(105, 12, 128, 0.04), 0px 1px 16px 0px rgba(110, 0, 136, 0.08);
}
.radar-poc-result-main {
    display: flex;
    flex: 1 1 0%;
    flex-direction: column;
    width: 100%;
    box-sizing: border-box;
    pointer-events: auto;
    padding: 16px;
    overflow: auto;
}


.radar-poc-candidate {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  column-gap: 8px;
  row-gap: 100%;
  padding-inline: 16px;
  flex-flow: wrap;
  gap: 6px;
  height: unset;
  overflow: hidden;
  padding: 20px 0 0 0;
}
.radar-poc-candidate ul {
  list-style: none;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  flex-flow: wrap;
  column-gap: 8px;
  row-gap: 100%;
  order: 1;
  height: unset;
  padding-inline-end: 2px;
  padding-inline-start: 0;
  margin: 0;
  overflow: hidden;
  gap: 6px;
}
.radar-poc-candidate li {
  overflow: hidden;
  box-sizing: border-box;
  margin: 0;
  word-break: break-all;
  border: none;
  cursor: pointer;
  color: rgb(6, 111, 172);
  border: 1px solid rgb(6, 111, 172);
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 10px;
}

.radar-poc-result-inner {
  flex: 1;
  overflow: auto;
}

.radar-poc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid rgb(243, 243, 243);
}
.radar-poc-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.radar-poc-header h2 {
  font-size: 20px;
}
.radar-poc-result-close {
  border: none;
}
.radar-poc-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  border-top: 1px solid rgb(243, 243, 243);
}
.radar-poc-footer input {
  flex: 1;
  padding: 12px 8px;
  margin-right: 10px;
  box-sizing: border-box;
  border: 1px solid #ddd;
  border-radius: 4px;
  transition: border-color 0.3s ease-in-out;
  box-shadow: none;
}
.radar-poc-footer input:focus {
  border-color: #2980B9;
  outline: none;
}
.radar-poc-footer button {
  height: 40px;
  width: 96px;
}
.radar-poc-result .loading-overlay {
  position: absolute;
  display: flex;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.25);
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.radar-poc-result .loading-spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  animation: radar-poc-spin 1s linear infinite;
}
@keyframes radar-poc-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`