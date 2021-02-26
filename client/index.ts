import get from 'miniget';
import fs from 'fs';
import unzipper from 'unzipper';
import { join } from 'path';

interface Config {
  dir: string;
  baseUrl: string;
}

interface Metadata {
  version: string;
  name: string;
  main: string;
}

const config: Config = require('./config.json');

const fetchLatest = () => {
  return new Promise(resolve => {
    const st = get(config.baseUrl + '/releases/latest')
      .pipe(unzipper.Extract({ path: config.dir }));
    st.on('close', resolve);
  });
}

const checkLatest = (version: string) => {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const check: string = JSON.parse(await get(config.baseUrl + '/releases?latest=1').text())?.data[0]?.replace(/\.zip/gi, '');
        if (version !== check) {
          console.log(`Update available! v${check}. Fetching...`);
          await fetchLatest();
        } else console.log('Already on the latest version');
        resolve(check);
      } catch (e) {
        reject(e);
      }
    })();
  });
}

const wait = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));
const isConstructor = (func: any) => {
  return (func && typeof func === 'function' && func.prototype && func.prototype.constructor) === func;
}

Promise.resolve().then(async () => {
  if (!fs.existsSync(config.dir)) await fetchLatest();

  const meta = (require(join(__dirname, config.dir, 'meta.json')) ?? {}) as Metadata;
  if (!meta.version || !meta.main) throw new Error('Invalid metadata');
  await checkLatest(meta.version);

  try { delete require.cache[require.resolve(join(__dirname, config.dir, 'meta.json'))]; } catch {};

  const Runner = require(join(__dirname, config.dir, meta.main));
  if (!isConstructor && typeof Runner === 'function') return Runner();
  if (isConstructor(Runner)) {
    const runnerInstance = new Runner(require(join(__dirname, config.dir, 'meta.json')));
    runnerInstance.run();
  };
}).catch(e => console.error(e.message, e.stack));