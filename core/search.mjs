import { DatabaseSync } from 'node:sqlite';
import { load } from 'cheerio';
import robotsParser from 'robots-parser';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { publicFetch } from './network.mjs';
const DEFAULT_SOURCES=[
  ['VS Code · релизы','https://github.com/microsoft/vscode/releases'],
  ['Node.js · релизы','https://github.com/nodejs/node/releases'],
  ['Electron · релизы','https://github.com/electron/electron/releases'],
  ['NASA · новости','https://www.nasa.gov/news/all-news/'],
  ['Habr · публикации','https://habr.com/ru/articles/'],
];
export function parseDocument(html,url) {
  const $=load(html); $('script,style,nav,footer,header,noscript,svg,form').remove();
  const title=($('meta[property="og:title"]').attr('content')||$('title').first().text()||$('h1').first().text()).trim().slice(0,400);
  const description=($('meta[name="description"]').attr('content')||$('meta[property="og:description"]').attr('content')||'').trim().slice(0,600);
  const text=($('article').first().text()||$('main').text()||$('body').text()).replace(/\s+/g,' ').trim().slice(0,200_000);
  const rawDate=$('meta[property="article:published_time"]').attr('content')||$('meta[name="date"]').attr('content')||$('time[datetime]').first().attr('datetime');
  const parsed=rawDate?Date.parse(rawDate):NaN;
  const publishedAt=Number.isFinite(parsed)&&parsed<=Date.now()+86400000?new Date(parsed).toISOString():null;
  const canonicalRaw=$('link[rel="canonical"]').attr('href'); let canonical=url;
  try { if(canonicalRaw) { const c=new URL(canonicalRaw,url); if(c.origin===new URL(url).origin) canonical=c.href; } }catch{}
  const links=[]; $('a[href]').each((_,el)=>{try{const u=new URL($(el).attr('href'),url);u.hash='';if(['https:','http:'].includes(u.protocol)&&u.origin===new URL(url).origin&&!/\.(png|jpe?g|gif|pdf|zip|exe|mp4)(\?|$)/i.test(u.href)&&!/[?&](login|signup|sort)=/.test(u.href))links.push(u.href);}catch{}});
  return {url:canonical,title:title||new URL(url).hostname,description,text,publishedAt,publishedSource:publishedAt?'source-metadata':null,links:[...new Set(links)].slice(0,60)};
}
export class SearchEngine {
  constructor(path=':memory:',{fetcher=publicFetch,seed=true,delay=1100}={}) {
    if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});this.db=new DatabaseSync(path);this.fetcher=fetcher;this.delay=delay;this.busy=false;this.progress=null;this.stopped=false;this.lastRun=null;this.robotCache=new Map();this.domainTimes=new Map();
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY,title TEXT NOT NULL,url TEXT NOT NULL UNIQUE,enabled INTEGER NOT NULL DEFAULT 1,last_checked TEXT,last_error TEXT);
      CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY,url TEXT NOT NULL UNIQUE,title TEXT,description TEXT,body TEXT,published_at TEXT,published_source TEXT,fetched_at TEXT,changed_at TEXT,hash TEXT,status INTEGER,etag TEXT,last_modified TEXT,source_id TEXT);
      CREATE VIRTUAL TABLE IF NOT EXISTS web_fts USING fts5(title,body,url UNINDEXED,tokenize='unicode61 remove_diacritics 2');`);
    if(seed&&Number(this.db.prepare('SELECT count(*) n FROM sources').get().n)===0)for(const [title,url]of DEFAULT_SOURCES)this.addSource(title,url);
  }
  sources(){return this.db.prepare('SELECT * FROM sources ORDER BY title').all();}
  addSource(title,url){const u=new URL(url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw new Error('Нужен публичный HTTP(S)-адрес'); const id=randomUUID();this.db.prepare('INSERT INTO sources(id,title,url) VALUES(?,?,?)').run(id,String(title||u.hostname).slice(0,150),u.href);return id;}
  removeSource(id){this.db.exec('BEGIN');try{const docs=this.db.prepare('SELECT url FROM documents WHERE source_id=?').all(id);for(const d of docs)this.db.prepare('DELETE FROM web_fts WHERE url=?').run(d.url);this.db.prepare('DELETE FROM documents WHERE source_id=?').run(id);this.db.prepare('DELETE FROM sources WHERE id=?').run(id);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}}
  status(){return {documents:Number(this.db.prepare('SELECT count(*) n FROM documents WHERE status=200').get().n),sources:this.sources(),busy:this.busy,progress:this.progress,lastRun:this.lastRun,coverage:'Пилотный собственный индекс. Охват ограничен подключёнными источниками; это не весь интернет.',mode:'independent',serverTime:new Date().toISOString()};}
  index(doc,sourceId=null,headers={}) {
    const now=new Date().toISOString();const hash=createHash('sha256').update(doc.text).digest('hex');const prev=this.db.prepare('SELECT * FROM documents WHERE url=?').get(doc.url);
    this.db.exec('BEGIN');try {
      this.db.prepare(`INSERT INTO documents(url,title,description,body,published_at,published_source,fetched_at,changed_at,hash,status,etag,last_modified,source_id) VALUES(?,?,?,?,?,?,?,?,?,200,?,?,?) ON CONFLICT(url) DO UPDATE SET title=excluded.title,description=excluded.description,body=excluded.body,published_at=excluded.published_at,published_source=excluded.published_source,fetched_at=excluded.fetched_at,changed_at=excluded.changed_at,hash=excluded.hash,status=200,etag=excluded.etag,last_modified=excluded.last_modified,source_id=coalesce(excluded.source_id,documents.source_id)`).run(doc.url,doc.title,doc.description||'',doc.text,doc.publishedAt||null,doc.publishedSource||null,now,prev?.hash===hash?prev.changed_at:now,hash,headers.etag||null,headers['last-modified']||null,sourceId);
      this.db.prepare('DELETE FROM web_fts WHERE url=?').run(doc.url);this.db.prepare('INSERT INTO web_fts(title,body,url) VALUES(?,?,?)').run(doc.title,doc.text,doc.url);this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  query(q,{period='all',site='',limit=20}={}) {
    const query=String(q||'').trim().slice(0,500);const terms=(query.replace(/site:\S+/g,'').match(/[\p{L}\p{N}]+/gu)||[]).slice(0,15);if(!terms.length)return {results:[],...this.status()};
    const siteTerm=query.match(/site:([^\s]+)/)?.[1];site=site||siteTerm||'';
    const match=terms.map(t=>'"'+t.replaceAll('"','')+'"*').join(' AND ');
    const rows=this.db.prepare(`SELECT d.*,bm25(web_fts,5.0,1.0,0.0) score FROM web_fts JOIN documents d ON d.url=web_fts.url WHERE web_fts MATCH ? AND d.status=200 ORDER BY score LIMIT 250`).all(match);
    const days={day:1,week:7,month:31}[period];let results=rows.filter(r=> {if(site){try{const h=new URL(r.url).hostname;if(h!==site&&!h.endsWith('.'+site))return false;}catch{return false;}}return !days||(r.published_at&&Date.parse(r.published_at)>=Date.now()-days*86400000);});
    if(days||/сегодня|новост|последн|latest|today|news/i.test(query))results.sort((a,b)=>Date.parse(b.published_at||'1970-01-01')-Date.parse(a.published_at||'1970-01-01')||a.score-b.score);
    return {results:results.slice(0,Math.min(limit,50)).map(r=>({url:r.url,title:r.title,snippet:r.description||r.body.slice(0,300),publishedAt:r.published_at,lastFetchedAt:r.fetched_at,changedAt:r.changed_at,stale:Date.now()-Date.parse(r.fetched_at)>86400000})),...this.status()};
  }
  async allowed(url) { const u=new URL(url); const allow=process.env.LIFEOS_CRAWL_ALLOWED_HOSTS?.split(',');if(allow&&!allow.includes(u.hostname))throw new Error('Источник недоступен в этой среде: ограничение сетевых доменов');let item=this.robotCache.get(u.origin);if(!item||Date.now()-item.at>3600000){const result=await this.fetcher(u.origin+'/robots.txt',{maxBytes:600000});if(result.status===404)item={parser:null,at:Date.now()};else if(result.status!==200)throw new Error('Не удалось проверить robots.txt ('+result.status+')');else item={parser:robotsParser(u.origin+'/robots.txt',result.text),at:Date.now()};this.robotCache.set(u.origin,item);}return item.parser?.isAllowed(url,'LifeOSBot')!==false; }
  async crawlUrl(url,sourceId) {
    if(!await this.allowed(url))throw new Error('Запрещено robots.txt');const origin=new URL(url).origin;const wait=this.delay-(Date.now()-(this.domainTimes.get(origin)||0));if(wait>0)await new Promise(r=>setTimeout(r,wait));this.domainTimes.set(origin,Date.now());
    const previous=this.db.prepare('SELECT * FROM documents WHERE url=?').get(url);const headers={};if(previous?.etag)headers['if-none-match']=previous.etag;if(previous?.last_modified)headers['if-modified-since']=previous.last_modified;
    const response=await this.fetcher(url,{headers,beforeFetch:target=>this.allowed(target)});
    if(response.url!==url&&!await this.allowed(response.url))throw new Error('Перенаправление запрещено robots.txt');
    if(response.status===304&&previous){this.db.prepare('UPDATE documents SET fetched_at=? WHERE url=?').run(new Date().toISOString(),url);return [];}
    if([404,410].includes(response.status)){this.db.prepare('UPDATE documents SET status=? WHERE url=?').run(response.status,url);this.db.prepare('DELETE FROM web_fts WHERE url=?').run(url);return [];}
    if(response.status!==200)throw new Error('Источник вернул HTTP '+response.status);
    if(!/text\/html|application\/xhtml/i.test(response.headers['content-type']||''))return [];
    const doc=parseDocument(response.text,response.url);this.index(doc,sourceId,response.headers);return doc.links;
  }
  async crawl({pagesPerSource=3}={}) {
    if(this.busy)return this.status();this.busy=true;this.stopped=false;
    try {for(const source of this.sources().filter(s=>s.enabled)){if(this.stopped)break;this.progress=source.title;let error=null;const queue=[source.url],seen=new Set();
      while(queue.length&&seen.size<pagesPerSource&&!this.stopped){const url=queue.shift();if(seen.has(url))continue;seen.add(url);try{const links=await this.crawlUrl(url,source.id);for(const link of links)if(!seen.has(link)&&new URL(link).origin===new URL(source.url).origin&&new URL(link).pathname.startsWith(new URL(source.url).pathname.replace(/\/$/,'')))queue.push(link);}catch(e){error=e.message.slice(0,200);}}
      this.db.prepare('UPDATE sources SET last_checked=?,last_error=? WHERE id=?').run(new Date().toISOString(),error,source.id);
    }this.lastRun=new Date().toISOString();}finally{this.busy=false;this.progress=null;}return this.status();
  }
  start(interval=30*60*1000){this.timer=setInterval(()=>this.crawl().catch(()=>{}),interval);this.timer.unref?.();this.initialTimer=setTimeout(()=>this.crawl().catch(()=>{}),500);this.initialTimer.unref?.();}
  async close(){this.stopped=true;clearInterval(this.timer);clearTimeout(this.initialTimer);while(this.busy)await new Promise(r=>setTimeout(r,30));this.db.close();}
}
