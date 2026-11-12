import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Capabilities, Entity, LifeState } from './types';
import { invoke, readableError } from './api';
const empty:LifeState={tasks:[],notes:[],events:[],habits:[],habitLogs:[],projects:[],bookmarks:[],finance:[],sessions:[],journal:[],launchers:[],settings:{}};
interface Toast {id:number;text:string;error?:boolean;action?:()=>void;actionLabel?:string;}
interface Context {data:LifeState;cap:Capabilities;loading:boolean;error:string;toasts:Toast[];refresh:()=>Promise<void>;notify:(text:string,error?:boolean,action?:()=>void,actionLabel?:string)=>void;save:(type:string,entity:Partial<Entity>)=>Promise<Entity|null>;remove:(type:string,entity:Entity)=>Promise<void>;complete:(id:string)=>Promise<void>;setting:(key:string,value:unknown)=>Promise<void>;run:<T=any>(action:string,args?:unknown)=>Promise<T|null>;}
const LifeContext=createContext<Context>(null!);
export function LifeProvider({children}:{children:ReactNode}){
  const [data,setData]=useState(empty),[cap,setCap]=useState<Capabilities>({desktop:false,platform:'web',nativeBrowser:false,virtualDisplay:false}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[toasts,setToasts]=useState<Toast[]>([]);
  const notify=useCallback((text:string,error=false,action?:()=>void,actionLabel='Отменить')=>{const id=Date.now()+Math.random();setToasts(t=>[...t.slice(-3),{id,text,error,action,actionLabel}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),6500);},[]);
  const refresh=useCallback(async()=>{try{setData(await invoke('state'));setError('');}catch(e){setError(readableError(e));}finally{setLoading(false);}},[]);
  useEffect(()=>{void refresh();invoke<Capabilities>('capabilities').then(setCap).catch(()=>{});},[refresh]);
  const run=useCallback(async<T,>(action:string,args:unknown={}):Promise<T|null>=>{try{return await invoke<T>(action,args);}catch(e){notify(readableError(e),true);return null;}},[notify]);
  const save=useCallback(async(type:string,entity:Partial<Entity>)=>{const result=await run<Entity>('save',{type,entity});if(result)await refresh();return result;},[run,refresh]);
  const remove=useCallback(async(type:string,entity:Entity)=>{const result=await run('remove',{type,id:entity.id});if(result){await refresh();notify('Запись удалена',false,()=>{void save(type,entity);});}},[run,refresh,notify,save]);
  const complete=useCallback(async(id:string)=>{if(await run('complete',{id}))await refresh();},[run,refresh]);
  const setting=useCallback(async(key:string,value:unknown)=>{const result=await run('settings',{key,value});if(result!==null)setData(d=>({...d,settings:{...d.settings,[key]:value}}));},[run]);
  useEffect(()=>{document.documentElement.dataset.theme=data.settings.profile?.theme||'dark';document.documentElement.dataset.accent=data.settings.profile?.accent||'sage';},[data.settings.profile]);
  return <LifeContext.Provider value={{data,cap,loading,error,toasts,refresh,notify,save,remove,complete,setting,run}}>{children}</LifeContext.Provider>;
}
export const useLife=()=>useContext(LifeContext);
