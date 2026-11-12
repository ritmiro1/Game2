import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createService } from '../core/service.mjs';
const root=resolve(fileURLToPath(new URL('../dist',import.meta.url)));
const searchOnly=process.argv.includes('--search-only');
const service=createService(resolve(process.env.LIFEOS_DATA_DIR||'.lifeos'),{autoCrawl:process.env.LIFEOS_AUTO_CRAWL!=='0'});
const buckets=new Map();
function rateLimit(ip){const now=Date.now();let b=buckets.get(ip);if(!b||now-b.at>60000)b={at:now,count:0};b.count++;buckets.set(ip,b);if(buckets.size>10000)for(const [key,v]of buckets)if(now-v.at>60000)buckets.delete(key);return b.count<=120;}
function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));}
function isAdmin(req){const token=process.env.LIFEOS_ADMIN_TOKEN;if(!token)return false;const provided=(req.headers.authorization||'').replace(/^Bearer /,'');const hash=s=>createHash('sha256').update(s).digest();return timingSafeEqual(hash(token),hash(provided));}
async function body(req){if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('Ожидается JSON');let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>10_000_000)throw new Error('Слишком большой запрос');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');}
const searchRoutes=new Set(['webSearch','searchStatus']);
const server=http.createServer(async(req,res)=>{
  res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  try{
    const url=new URL(req.url,'http://'+req.headers.host);
    if(url.pathname==='/healthz')return json(res,200,{ok:true,product:'LifeOS',version:'0.1.0'});
    if(url.pathname.startsWith('/api/')){
      if(!rateLimit(req.socket.remoteAddress))return json(res,429,{error:'Слишком много запросов. Попробуйте через минуту.'});
      if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'Недопустимый origin'});
      if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Межсайтовый запрос запрещён'});
      let action,args={};
      if(url.pathname==='/api/search'&&req.method==='POST'){action='webSearch';args=await body(req);}
      else if(url.pathname==='/api/search/status'&&req.method==='GET')action='searchStatus';
      else if(url.pathname==='/api/rpc'&&req.method==='POST'){const b=await body(req);action=b.action;args=b.args||{};}
      else return json(res,404,{error:'Маршрут не найден'});
      if(searchOnly&&!searchRoutes.has(action)&&!(['crawl','addSource','removeSource'].includes(action)&&isAdmin(req)))return json(res,403,{error:'Доступно только поисковое API. Для управления нужен admin token.'});
      return json(res,200,{data:await service.invoke(action,args)});
    }
    if(searchOnly)return json(res,404,{error:'Life Search API'});
    if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Метод не поддерживается'});
    let path=resolve(root,'.'+decodeURIComponent(url.pathname));if(path!==root&&!path.startsWith(root+sep))return json(res,403,{error:'Недопустимый путь'});
    try{if((await stat(path)).isDirectory())path=resolve(path,'index.html');}catch{if(extname(path))return json(res,404,{error:'Файл не найден'});path=resolve(root,'index.html');}
    const data=await readFile(path);const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.json':'application/json','.map':'application/json'}[extname(path)]||'application/octet-stream';
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'");res.writeHead(200,{'content-type':mime,'cache-control':extname(path)==='.html'?'no-cache':'public,max-age=3600'});res.end(req.method==='HEAD'?undefined:data);
  }catch(error){if(!res.headersSent)json(res,400,{error:error.message||'Ошибка запроса'});else res.end();}
});
const port=Number(process.env.PORT||3101);server.listen(port,process.env.HOST||'0.0.0.0',()=>console.log(`LifeOS ${searchOnly?'search API':'preview'} listening on 0.0.0.0:${port}`));
async function stop(){server.close();await service.close();process.exit(0);}process.on('SIGTERM',stop);process.on('SIGINT',stop);
