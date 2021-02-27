import archiver from 'archiver';
import fs, { PathLike } from 'fs';
import crypto from 'crypto';

interface Config {
  dir: string;
  out: string;
  metadata: string;
}

interface Entry extends archiver.EntryData {
  sourcePath: string;
  type: 'file' | 'directory';
  callback: Function
}

interface Checksums {
  [key: string]: any;
}

const config: Config = require('./packer.config.json') ?? {
  dir: 'src',
  out: 'releases/$name-$version.zip',
  metadata: './package.json'
};
const { version, name } = require(config.metadata ?? './package.json');
const generateChecksum = (path: PathLike) => {
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

const archive = archiver('zip');
archive.on('error', (e) => {
  console.log('Archive error', e);
  process.exit(1);
});

const checksums: Checksums = {};
const outDir = config.out
  .replace(/\$timestamp/gi, Date.now().toString())
  .replace(/\$name/gi, name)
  .replace(/\$version/gi, version);

let timeout: NodeJS.Timeout;
const setFinalizeTimeout = (ms = 1000) => {
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(() => {
    archive.append(JSON.stringify(checksums), {
      name: `checksums.json`
    });
    archive.finalize();
  }, ms);
};

const writeStream = fs.createWriteStream(outDir);
writeStream.on('close', async () => {
  console.log(`Zipping done! Written ${archive.pointer()} bytes of data.`);

  await fs.promises.writeFile(outDir.replace(/\.zip/gi, '.checksums.json'), JSON.stringify(checksums));
  console.log(`Checksums written! Exiting...`);
});

archive.directory(config.dir, false)
  .on('entry', async (entry: Entry) => {
    if (entry.name === 'checksums.json') return;
    if (entry.type === 'directory') return;

    const relativePath = entry.sourcePath?.slice(entry.sourcePath.indexOf(config.dir) + config.dir.length + 1);
    try { checksums[relativePath] = await generateChecksum(entry.sourcePath); } catch {};
    setFinalizeTimeout();
  });

archive.pipe(writeStream);
