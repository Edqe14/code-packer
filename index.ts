import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import fs from 'fs';
import watch from 'node-watch';
import dotenv from 'dotenv';
dotenv.config();

interface Config {
  dir: string;
  out: string;
}

const config: Config = require('./packer.config.json');

const app = express();
app.use(helmet());
app.use(morgan('tiny'));
app.use(cors());

const caches = new Map() as Map<string, any>;
Promise.resolve().then(() => {
  const releasesDir = config.out.split('/');
  releasesDir.pop();

  const cacheReleases = () => {
    const dirList = fs.readdirSync(releasesDir.join('/'));
    if (!dirList) return;
    caches.set('releases', dirList);
  }
  cacheReleases();

  // watch releases folder
  watch(releasesDir.join('/'), {
    recursive: true,
    filter: /\.zip$/
  }, cacheReleases);
});

app.get('/releases', (req, res) => {
  let data = caches.get('releases') ?? [];
  if (req.query.latest) {
    data = [data[data.length - 1]];
  }

  return res.json({
    data
  });
});

app.get('/releases/:file', (req, res, next) => {
  res.setHeader('Accept-Ranges', 'bytes');

  let filename = req.params.file;
  if (filename === 'latest') {
    const versions = caches.get('releases') ?? [];
    filename = versions[versions.length - 1];
  }

  if (!filename) return res.status(400).json({
    message: 'Invalid filename',
    code: 400
  });

  const dir = config.out.split('/');
  dir.pop();
  dir.push(filename);
  if (!(caches.get('releases') ?? []).includes(filename) && !fs.existsSync(dir.join('/'))) return res.status(404).json({
    message: 'Can\'t found the version',
    code: 404
  });

  const check = fs.lstatSync(dir.join('/'));
  res.setHeader('Content-Type', 'application/zip');
  
  let range: any = req.get('Range');
  if (range) {
    let tempRange = range.split('=');
    if (tempRange[0] !== 'bytes') return res.status(406).json({
      message: 'Only accepts bytes range',
      code: 406
    });
    
    const [start, end] = tempRange[1]?.split('-').map((s: string) => parseInt(s)).map((v: number) => isNaN(v) ? Infinity : v) as [number, number];
    
    if ((end !== Infinity && end < start) || start > check.size || (end !== Infinity && end > check.size) || start < 0) return res.status(406).json({
      message: 'Out of range',
      code: 406
    });
    
    range = { start, end };
  }

  res.setHeader('Content-Length', range ? (range.end === Infinity ? check.size : range.end) - range.start : check.size);
  
  try {
    range ? res.status(206) : res.status(200);

    const file = fs.createReadStream(dir.join('/'), range);
    file.pipe(res);

    res.on('close', () => {
      file.destroy();
    });
  } catch (e) {
    res.status(500).send({
      message: 'Internal Error',
      code: 500
    });
    console.log(e);
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Listening to port ${PORT}`);
});