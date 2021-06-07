const http = require('http');
const path = require('path');
const fs = require('fs');

const mimeTypes = {
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript'
};

const imagesDir = '//10.10.1.201/priv/p/1/';

http.createServer((req, res) => {
  console.log(req.url);

  let filepath = '';
  if (req.url.startsWith('/image/'))
    filepath = path.join(imagesDir, req.url.replace(/^\/image\//, ''));
  else if (req.url === '/')
    filepath = path.join(__dirname, '/index.html');
  else
    filepath = path.join(__dirname, req.url);

  fs.readFile(filepath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }

    const type = mimeTypes[path.extname(filepath).slice(1)];
    if (type)
      res.setHeader('Content-Type', type);

    res.writeHead(200);
    res.end(data);
  });
}).listen(8080);
