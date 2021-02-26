const axios = require('axios');
const meta = require('../meta.json');

axios({
  url: 'http://localhost:8080/releases?latest=1'
}).then(res => {
  if (res.status !== 200) return console.log('Failed to fetch updates!');
  const version = res.data?.data[0]?.replace(/\.zip/gi, '');
  if (meta.version !== version) return console.log(`Update available! v${version}`);
  console.log('Already on latest version available');
}).catch(console.error);
