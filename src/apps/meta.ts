import { Sun,Globe2,CheckCheck,NotebookPen,CalendarDays,FolderKanban,Flame,Timer,FolderOpen,Wallet,BookOpen,Settings2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppId } from '../types';
export const APPS:{id:AppId;name:string;description:string;icon:LucideIcon;color:string}[]=[
  {id:'today',name:'Мой день',description:'Главное здесь и сейчас',icon:Sun,color:'sage'},
  {id:'browser',name:'Life Browser',description:'Интернет и свой поиск',icon:Globe2,color:'blue'},
  {id:'tasks',name:'Задачи',description:'От идеи до результата',icon:CheckCheck,color:'sage'},
  {id:'notes',name:'Заметки',description:'Место для ваших мыслей',icon:NotebookPen,color:'amber'},
  {id:'calendar',name:'Календарь',description:'Время для важного',icon:CalendarDays,color:'coral'},
  {id:'projects',name:'Проекты',description:'Общая картина',icon:FolderKanban,color:'lavender'},
  {id:'habits',name:'Привычки',description:'Маленькие шаги каждый день',icon:Flame,color:'coral'},
  {id:'focus',name:'Фокус',description:'Одно дело. Всё внимание.',icon:Timer,color:'sage'},
  {id:'files',name:'Материалы',description:'Ссылки, загрузки и файлы',icon:FolderOpen,color:'blue'},
  {id:'finance',name:'Финансы',description:'Простой учёт денег',icon:Wallet,color:'amber'},
  {id:'journal',name:'Дневник',description:'Сохранить момент',icon:BookOpen,color:'lavender'},
  {id:'settings',name:'Настройки',description:'LifeOS по вашим правилам',icon:Settings2,color:'neutral'},
];
export const appMeta=(id:AppId)=>APPS.find(a=>a.id===id)!;
