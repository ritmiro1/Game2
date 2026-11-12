import React from 'react';
import ReactDOM from 'react-dom/client';
import { LifeProvider } from './state';
import { App } from './App';
import './styles.css';
class ErrorBoundary extends React.Component<{children:React.ReactNode},{error:string}>{state={error:''};static getDerivedStateFromError(e:Error){return {error:e.message};}render(){return this.state.error?<div className="fatal"><h1>Не удалось открыть LifeOS</h1><p>{this.state.error}</p><button onClick={()=>location.reload()}>Перезапустить интерфейс</button><p>Ваши данные не удалены.</p></div>:this.props.children;}}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><LifeProvider><App/></LifeProvider></ErrorBoundary></React.StrictMode>);
