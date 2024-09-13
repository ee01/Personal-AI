# Local build (if your change code)
1. `npm install --force`
2. `npm run start` or  `npm run build`

# Step
1. open url `chrome://extensions/`
2. enable `Development mode`
3. click button `Load unpacked`
4. select radar poc fe -> `dist` folder
5. open `https://app.ringcentral.com/`
6. click `radar poc` extensions

If it doesn't work, please check the extension permissions:
1. Right-click on `radar poc` extension
2. Click `This can Read and change site data`

# Update flow
1. open url `chrome://extensions/`
2. enable `Development mode`
3. click button `Update`
4. reload page `https://app.ringcentral.com/`