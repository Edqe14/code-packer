import get from 'miniget';
import fs, { PathLike } from 'fs';
import unzipper from 'unzipper';
import { join } from 'path';
import crypto from 'crypto';

interface Config {
  dir: string;
  baseUrl: string;
}

interface Metadata {
  version: string;
  name: string;
  main: string;
}

interface Checksum {
  md5: string;
  sha1: string;
  sha256: string;
}

const config: Config = require('./config.json');
const generateChecksum = (path: PathLike): Promise<Checksum> => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(path)) return reject(new Error('Invalid Path'));
    if (fs.statSync(path).isDirectory()) return reject(new Error('Path is a directory'));
    
    const stream = fs.createReadStream(path);
    
    const md5 = crypto.createHash('md5');
    const sha1 = crypto.createHash('sha1');
    const sha256 = crypto.createHash('sha256');
    stream.on('data', (c) => {
      md5.update(c);
      sha1.update(c);
      sha256.update(c);
    });
    
    stream.on('end', () => {
      stream.close();
      resolve({
        md5: md5.digest('hex'),
        sha1: sha1.digest('hex'),
        sha256: sha256.digest('hex')
      });
    });
  });
}

const isValid = (main: Checksum, local: Checksum) => {
  if (
    main.md5 !== local.md5 ||
    main.sha1 !== local.sha1 ||
    main.sha256 !== local.sha256
  ) return false;
  return true;
}

const fetchLatest = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const st = get(config.baseUrl + '/releases/latest')
      .pipe(unzipper.Extract({ path: join(__dirname, config.dir) }));
    st.on('close', async () => {
      try {
        const checksums = require(join(__dirname, config.dir, 'checksums.json'));
        try { delete require.cache[require.resolve(join(__dirname, config.dir, 'checksums.json'))] } catch {};

        if (!checksums) return reject(new Error('No checksum'));

        for (const file of Object.keys(checksums)) {
          const path = join(__dirname, config.dir, file);
          if (!fs.existsSync(path)) return reject(new Error('Missing file'));

          const checksum: Checksum = checksums[file];
          const localChecksum = await generateChecksum(path);
          if (!isValid(checksum, localChecksum)) return reject(new Error(`Invalid file "${file}"`));
        }

        console.log('All files validated');
        resolve();
      } catch (e) {
        reject(e);
      }
    });
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

const isConstructor = (func: any) => {
  return (func && typeof func === 'function' && func.prototype && func.prototype.constructor) === func;
}

Promise.resolve().then(async () => {
  if (!fs.existsSync(join(__dirname, config.dir))) await fetchLatest();

  const meta = (require(join(__dirname, config.dir, 'meta.json')) ?? {}) as Metadata;
  if (!meta.version || !meta.main) throw new Error('Invalid metadata');
  await checkLatest(meta.version);

  try { delete require.cache[require.resolve(join(__dirname, config.dir, 'meta.json'))]; } catch {};
  console.clear();

  const Runner = require(join(__dirname, config.dir, meta.main));
  if (!isConstructor && typeof Runner === 'function') return Runner();
  if (isConstructor(Runner)) {
    const runnerInstance = new Runner(require(join(__dirname, config.dir, 'meta.json')));
    runnerInstance.run();
  };
}).catch(e => console.error(e.message, e.stack));