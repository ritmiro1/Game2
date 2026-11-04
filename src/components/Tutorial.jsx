import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, BrainCircuit, Check, Clock3, Radio, Shield, Sparkles, Swords } from 'lucide-react';
import { FRONTS, STORY_CHAPTERS } from '../../shared/content.js';
import { CheckLine, Glyph, OrderCard } from './UI.jsx';

const STEPS = [
  { id: 'simultaneous', number: '01', title: 'Одновременный приказ', icon: BrainCircuit },
  { id: 'echo', number: '02', title: 'Закон Эха', icon: Radio },
  { id: 'epochs', number: '03', title: 'Три эпохи', icon: Sparkles },
  { id: 'tempo', number: '04', title: 'Темп и защита', icon: Clock3 },
  { id: 'story', number: '05', title: 'Летопись Вэя', icon: BookOpen },
];

export default function Tutorial({ onBack, onTraining }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  return (
    <main className="tutorial-screen page-shell">
      <div className="page-title-row">
        <div>
          <button className="text-button page-back" onClick={onBack}><ArrowLeft size={15} /> ГЛАВНАЯ</button>
          <div className="eyebrow">АКАДЕМИЯ / ВВЕДЕНИЕ В ПРОФЕССИЮ</div>
          <h1>ПЯТЬ МИНУТ ДО ПЕРВОЙ ПРАВКИ</h1>
          <p>Здесь нет реакции на миллисекунды. Только план, чтение соперника и умение отвечать за своё будущее.</p>
        </div>
        <button className="button button--primary" onClick={onTraining}><Swords size={17} /> ТРЕНИРОВОЧНАЯ ДУЭЛЬ</button>
      </div>
      <div className="tutorial-layout">
        <nav className="tutorial-nav">
          {STEPS.map((item, index) => {
            const Icon = item.icon;
            return <button key={item.id} className={step === index ? 'is-active' : ''} onClick={() => setStep(index)}><span>{item.number}</span><Icon size={18} /><div><strong>{item.title}</strong><small>{index < step ? 'Изучено' : index === step ? 'Открыто' : 'Далее'}</small></div>{index < step && <Check size={14} />}</button>;
          })}
        </nav>
        <section className="tutorial-content">
          {current.id === 'simultaneous' && (
            <>
              <div className="tutorial-content__heading"><span className="section-index">УРОК 01</span><h2>ВЫ НЕ ОТВЕЧАЕТЕ НА ХОД.<br />ВЫ ПРЕДСКАЗЫВАЕТЕ ЕГО.</h2></div>
              <p className="tutorial-lead">Оба редактора выбирают по одному приказу из руки в пять карт. До раскрытия соперник видит лишь факт вашей готовности — не карту и не цель.</p>
              <div className="simultaneous-demo">
                <div><span>ВАШ СКРЫТЫЙ ВЫБОР</span><OrderCard cardId="surge" /></div>
                <div className="simultaneous-demo__versus"><i /><strong>РАСКРЫТИЕ</strong><Swords size={26} /><i /></div>
                <div><span>ВЫБОР ОППОНЕНТА</span><OrderCard cardId="barrier" /></div>
              </div>
              <ul className="tutorial-rules"><CheckLine>Недоступные по заряду приказы подсвечены заранее.</CheckLine><CheckLine>После раскрытия рука пополняется до пяти карт.</CheckLine><CheckLine>В сетевой дуэли на решение даётся 45 секунд.</CheckLine></ul>
            </>
          )}
          {current.id === 'echo' && (
            <>
              <div className="tutorial-content__heading"><span className="section-index">УРОК 02</span><h2>БУДУЩЕЕ ПОМНИТ<br />КАЖДУЮ ВАШУ СТРОКУ.</h2></div>
              <p className="tutorial-lead">Сыгранный приказ создаёт Эхо. Через два раунда оно бесплатно повторит числовые эффекты с силой 60%. Будущие Эхи видны обоим игрокам — это фундамент для обманов и ловушек.</p>
              <div className="echo-timeline-demo">
                <div className="echo-timeline-demo__event"><span>РАУНД 02</span><OrderCard cardId="pulse" compact /><strong>НАТИСК СОЗДАЁТ ЭХО</strong></div>
                <div className="echo-timeline-demo__line"><i /><Radio size={25} /><i /></div>
                <div className="echo-timeline-demo__event echo-timeline-demo__event--future"><span>РАУНД 04</span><OrderCard cardId="pulse" compact echo /><strong>ПОВТОР: 2 УРОНА · СДВИГ 1</strong></div>
              </div>
              <div className="tutorial-callout"><Radio size={22} /><div><strong>Эхо разрешается до новых приказов.</strong><p>Щит из Эха успеет защитить вас в этот же раунд. Особые эффекты вроде копирования или стирания не повторяются.</p></div></div>
            </>
          )}
          {current.id === 'epochs' && (
            <>
              <div className="tutorial-content__heading"><span className="section-index">УРОК 03</span><h2>ДВЕ ЭПОХИ —<br />ОДНА ВЕРСИЯ ПОБЕДЫ.</h2></div>
              <p className="tutorial-lead">Сдвигайте контроль эпох к своей стороне. На отметке 6 эпоха фиксируется за вами навсегда и наносит сопернику 4 урона. Захватите любые две — или сотрите Целостность оппонента.</p>
              <div className="epochs-demo">
                {FRONTS.map((front, index) => <div key={front.id} style={{ '--front-color': front.color }}><Glyph index={index} size={65} /><span>{front.index}</span><strong>{front.name}</strong><small>{front.epithet}</small><i><b style={{ width: `${[67, 50, 33][index]}%` }} /></i><em>{['ВАШ КОНТРОЛЬ +2', 'НЕЙТРАЛЬНО', 'КОНТРОЛЬ ВРАГА −2'][index]}</em></div>)}
              </div>
              <ul className="tutorial-rules"><CheckLine>Захваченная эпоха больше не принимает сдвиги.</CheckLine><CheckLine>Если никто не победил к 20-му раунду, решают эпохи, Целостность и контроль.</CheckLine><CheckLine>Вектор наносит 6 урона захватом вместо 4 — его пассивное свойство.</CheckLine></ul>
            </>
          )}
          {current.id === 'tempo' && (
            <>
              <div className="tutorial-content__heading"><span className="section-index">УРОК 04</span><h2>СНАЧАЛА ЗАСЛОН.<br />ПОТОМ — УДАР.</h2></div>
              <p className="tutorial-lead">Приказ с большим Темпом раскрывается раньше. Заслон с Темпом 8 успеет поглотить Пульс с Темпом 6. При равном Темпе первым действует владелец инициативы; она меняется каждый раунд.</p>
              <div className="tempo-demo">
                <div><span>8</span><OrderCard cardId="barrier" compact /><strong>1. ЩИТ УСТАНОВЛЕН</strong></div>
                <ArrowRight size={24} />
                <div><span>6</span><OrderCard cardId="pulse" compact /><strong>2. УРОН ПОГЛОЩЁН</strong></div>
                <div className="tempo-demo__result"><Shield size={34} /><strong>4 → 1</strong><span>ЩИТ ПОСЛЕ УДАРА</span></div>
              </div>
              <div className="tutorial-callout"><BrainCircuit size={22} /><div><strong>Оракул тоже строит такие цепочки.</strong><p>На третьей сложности бот сравнивает вероятные пары приказов и смотрит на раунд вперёд. Он не получает ваш скрытый выбор — только открытую историю.</p></div></div>
            </>
          )}
          {current.id === 'story' && (
            <>
              <div className="tutorial-content__heading"><span className="section-index">ЛЕТОПИСЬ</span><h2>23:59:59.<br />ГОРОД ЖДЁТ АВТОРА.</h2></div>
              <div className="story-chapters">{STORY_CHAPTERS.map((chapter) => <article key={chapter.number}><span>{chapter.number}</span><div><h3>{chapter.title}</h3><p>{chapter.text}</p></div></article>)}</div>
              <blockquote className="story-quote">«Мы помним не то, что произошло. Мы помним то, чью правку пережили».<span>— найдено на полях последнего Архива</span></blockquote>
            </>
          )}
          <div className="tutorial-pagination">
            <button className="button button--ghost" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ArrowLeft size={16} /> НАЗАД</button>
            <span>{step + 1} / {STEPS.length}</span>
            {step < STEPS.length - 1 ? <button className="button button--outline" onClick={() => setStep((value) => value + 1)}>СЛЕДУЮЩИЙ УРОК <ArrowRight size={16} /></button> : <button className="button button--primary" onClick={onTraining}>НАЧАТЬ ОБУЧЕНИЕ <Swords size={16} /></button>}
          </div>
        </section>
      </div>
    </main>
  );
}
