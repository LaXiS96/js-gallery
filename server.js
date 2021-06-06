const http = require('http');
const path = require('path');
const fs = require('fs');

const imagesDir = '//10.10.1.201/priv/p/1/';

http.createServer((req, res) => {
  console.log(req.url);

  let filepath = '';
  if (req.url.startsWith('/image/'))
    filepath = path.join(imagesDir, req.url.replace(/^\/image\//, ''));
  else
    filepath = path.join(__dirname, req.url);

  fs.readFile(filepath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }

    res.writeHead(200);
    res.end(data);
  });
}).listen(8080);
