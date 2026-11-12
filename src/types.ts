export type AppId = 'today'|'browser'|'tasks'|'notes'|'calendar'|'projects'|'habits'|'focus'|'files'|'finance'|'journal'|'settings';
export interface Entity { id: string; title: string; [key: string]: any }
export interface LifeState { tasks: Entity[]; notes: Entity[]; events: Entity[]; habits: Entity[]; habitLogs: Entity[]; projects: Entity[]; bookmarks: Entity[]; finance: Entity[]; sessions: Entity[]; journal: Entity[]; launchers: Entity[]; settings: Record<string, any>; }
export interface Capabilities { desktop:boolean;platform:string;nativeBrowser:boolean;virtualDisplay:boolean;version?:string; }
export interface SearchResult { url:string; title:string; snippet:string; publishedAt:string|null; lastFetchedAt:string; stale:boolean; }
export interface Source { id:string;title:string;url:string;last_checked:string|null;last_error:string|null; }
export interface SearchStatus { documents:number;sources:Source[];busy:boolean;progress:string|null;lastRun:string|null;coverage:string;mode:string; }
export interface SearchResponse extends SearchStatus { results:SearchResult[]; }
export interface NativeTab {id:string;url:string;title:string;loading:boolean;canGoBack:boolean;canGoForward:boolean;private?:boolean;}
export interface DisplayInfo {id:number;label:string;bounds:{x:number;y:number;width:number;height:number};scaleFactor:number;primary:boolean;virtual:boolean;}
export interface WindowState {id:AppId;workspace:string;x:number;y:number;width:number;height:number;maximized:boolean;minimized:boolean;z:number;}
export interface DesktopBridge { invoke<T=any>(action:string,args?:any):Promise<T>; on(channel:string,callback:(payload:any)=>void):()=>void; }
declare global {interface Window {lifeos?:DesktopBridge;}}
