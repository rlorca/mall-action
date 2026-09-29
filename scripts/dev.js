import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {join,extname,resolve} from 'node:path';
const root=process.cwd(), port=Number(process.env.PORT||5173);
createServer(async(req,res)=>{try{const p=resolve(join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname)));if(!p.startsWith(root))throw Error();const f=(await stat(p)).isDirectory()?join(p,'index.html'):p;const type={'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(f)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(await readFile(f))}catch{res.writeHead(404);res.end('Not found')}}).listen(port,()=>console.log(`http://localhost:${port}`));
