import archiver from 'archiver';
import fs from 'fs';

interface Config {
  dir: string;
  out: string;
  metadata: string;
}

const config: Config = require('./packer.config.json') ?? {
  dir: 'src',
  out: 'releases/$name-$version.zip',
  metadata: './package.json'
};
const { version, name } = require(config.metadata ?? './package.json');

const archive = archiver('zip');
archive.on('error', (e) => {
  console.log('Archive error', e);
  process.exit(1);
});

const outDir = config.out
  .replace(/\$timestamp/gi, Date.now().toString())
  .replace(/\$name/gi, name)
  .replace(/\$version/gi, version);
const writeStream = fs.createWriteStream(outDir);
writeStream.on('close', () => {
  console.log(`Zipping done! Written ${archive.pointer()} bytes of data.`);
});

archive.directory(config.dir, false);
archive.pipe(writeStream);
archive.finalize();
