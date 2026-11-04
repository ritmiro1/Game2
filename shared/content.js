export const GAME_TITLE = 'ПАЛИМПСЕСТ';
export const GAME_SUBTITLE = 'Протокол Эха';
export const MAX_HP = 28;
export const MAX_ENERGY = 10;
export const CONTROL_LIMIT = 6;
export const MAX_ROUNDS = 20;
export const ECHO_DELAY = 2;
export const ECHO_SCALE = 0.6;
export const TURN_SECONDS = 45;

export const FRONTS = [
  {
    id: 'origin',
    name: 'ИСТОК',
    index: 'I',
    epithet: 'Город до падения',
    lore: 'Здесь Вэй ещё слышит дождь. Удержите воспоминание — и у города появится прошлое.',
    color: '#74e4d0',
  },
  {
    id: 'fracture',
    name: 'РАЗЛОМ',
    index: 'II',
    epithet: 'Последняя секунда',
    lore: 'Мгновение катастрофы повторяется бесконечно. Каждый приказ меняет его геометрию.',
    color: '#f1ba73',
  },
  {
    id: 'crown',
    name: 'ВЕНЕЦ',
    index: 'III',
    epithet: 'Ненаписанное будущее',
    lore: 'Единственная эпоха, которой никогда не было. Победитель решит, заслуживает ли она жизни.',
    color: '#b9a0ff',
  },
];

const card = (definition) => ({ targeted: false, rarity: 'Обычный', ...definition });

export const CARDS = {
  spark: card({
    id: 'spark', name: 'Вспышка', school: 'Импульс', icon: 'Sparkles', cost: 0, tempo: 5,
    damage: 1, shift: 1, targeted: true,
    text: '1 урон · сдвиг 1', flavor: 'Самое маленькое решение тоже оставляет шрам.',
  }),
  pulse: card({
    id: 'pulse', name: 'Пульс', school: 'Импульс', icon: 'Zap', cost: 1, tempo: 6,
    damage: 3, shift: 1, targeted: true,
    text: '3 урона · сдвиг 1', flavor: 'Город отвечает на правильную частоту.',
  }),
  lance: card({
    id: 'lance', name: 'Игла', school: 'Импульс', icon: 'MoveUpRight', cost: 2, tempo: 7,
    damage: 5, pierce: 1,
    text: '5 урона · 1 пробитие щита', flavor: 'Между двумя строками всегда есть место для лезвия.',
  }),
  surge: card({
    id: 'surge', name: 'Натиск', school: 'Импульс', icon: 'ChevronsUp', cost: 3, tempo: 4,
    damage: 5, shift: 2, targeted: true,
    text: '5 урона · сдвиг 2', flavor: 'Не просить будущее. Настаивать.',
  }),
  fracture: card({
    id: 'fracture', name: 'Раскол', school: 'Импульс', icon: 'TriangleAlert', cost: 4, tempo: 3,
    damage: 8, selfDamage: 2, shift: 1, targeted: true, rarity: 'Редкий',
    text: '8 урона · сдвиг 1 · себе 2', flavor: 'Сила без потерь — просто ещё одна выдумка.',
  }),
  barrier: card({
    id: 'barrier', name: 'Заслон', school: 'Оплот', icon: 'Shield', cost: 1, tempo: 8,
    shield: 4,
    text: '4 щита до конца раунда', flavor: 'Сохранить строку. Любой ценой.',
  }),
  anchor: card({
    id: 'anchor', name: 'Якорь', school: 'Оплот', icon: 'Anchor', cost: 2, tempo: 3,
    shield: 3, shift: 2, targeted: true,
    text: '3 щита · сдвиг 2', flavor: 'Даже эпохе нужно место, где больше не дрейфовать.',
  }),
  well: card({
    id: 'well', name: 'Источник', school: 'Правка', icon: 'Waves', cost: 0, tempo: 2,
    gain: 3,
    text: '+3 заряда', flavor: 'Вчерашний дождь всё ещё можно собрать.',
  }),
  sweep: card({
    id: 'sweep', name: 'Смещение', school: 'Правка', icon: 'Orbit', cost: 1, tempo: 5,
    shift: 2, targeted: true,
    text: 'Сдвиг 2 выбранной эпохи', flavor: 'Изменить акцент — изменить смысл.',
  }),
  sever: card({
    id: 'sever', name: 'Обрыв', school: 'Правка', icon: 'Scissors', cost: 2, tempo: 6,
    damage: 1, eraseEnemy: true,
    text: '1 урон · стирает ближайшее вражеское Эхо', flavor: 'У будущего тоже есть нить.',
  }),
  loop: card({
    id: 'loop', name: 'Петля', school: 'Правка', icon: 'RefreshCw', cost: 1, tempo: 4,
    gain: 1, accelerateSelf: true,
    text: '+1 заряд · ваше ближайшее Эхо наступит раньше', flavor: 'Встретить последствие на полшага раньше.',
  }),
  leech: card({
    id: 'leech', name: 'Синфаза', school: 'Оплот', icon: 'HeartPulse', cost: 2, tempo: 5,
    damage: 2, heal: 2, shift: 1, targeted: true,
    text: '2 урона · лечение 2 · сдвиг 1', flavor: 'Два города. Один пульс.',
  }),
  stasis: card({
    id: 'stasis', name: 'Статис', school: 'Оплот', icon: 'Snowflake', cost: 2, tempo: 8,
    shield: 3, delayEnemy: true,
    text: '3 щита · вражеское Эхо наступит позже', flavor: 'Секунда под стеклом.',
  }),
  sanctuary: card({
    id: 'sanctuary', name: 'Апокриф', school: 'Оплот', icon: 'ShieldPlus', cost: 3, tempo: 7,
    shield: 6, shift: 1, targeted: true, rarity: 'Подпись',
    text: '6 щита · сдвиг 1', flavor: 'Ария хранит даже те строки, которые стёр автор.',
  }),
  restoration: card({
    id: 'restoration', name: 'Восстановление', school: 'Оплот', icon: 'BookHeart', cost: 2, tempo: 4,
    heal: 4, gain: 1, rarity: 'Подпись',
    text: 'Лечение 4 · +1 заряд', flavor: 'Не всё утраченное обязано оставаться утраченным.',
  }),
  execution: card({
    id: 'execution', name: 'Развязка', school: 'Импульс', icon: 'Crosshair', cost: 4, tempo: 6,
    damage: 5, executeDamage: 8, shift: 1, targeted: true, rarity: 'Подпись',
    text: '5 урона · 8, если у врага ≤14 Целостности · сдвиг 1', flavor: 'Вектор всегда знает, чем кончается глава.',
  }),
  overclock: card({
    id: 'overclock', name: 'Форсаж', school: 'Правка', icon: 'Gauge', cost: 0, tempo: 9,
    gain: 4, selfDamage: 2, rarity: 'Подпись',
    text: '+4 заряда · себе 2 урона', flavor: 'Сжечь страницу ради чернила.',
  }),
  fork: card({
    id: 'fork', name: 'Развилка', school: 'Правка', icon: 'GitBranch', cost: 2, tempo: 5,
    shift: 1, duplicateSelf: true, targeted: true, rarity: 'Подпись',
    text: 'Сдвиг 1 · копирует ваше ближайшее Эхо', flavor: 'Мирра не выбирает между возможностями.',
  }),
  mirror: card({
    id: 'mirror', name: 'Острие зеркала', school: 'Оплот', icon: 'FlipHorizontal2', cost: 2, tempo: 8,
    shield: 3, thorns: 2, rarity: 'Подпись',
    text: '3 щита · атакующий получает 2 урона', flavor: 'Всякая атака что-то рассказывает об авторе.',
  }),
  inversion: card({
    id: 'inversion', name: 'Инверсия', school: 'Правка', icon: 'Repeat2', cost: 3, tempo: 6,
    stealEnemy: true, shift: 1, targeted: true, rarity: 'Подпись',
    text: 'Переписывает вражеское Эхо на себя · сдвиг 1', flavor: 'Нуль не создаёт. Нуль меняет подпись.',
  }),
  nullfield: card({
    id: 'nullfield', name: 'Нуль-поле', school: 'Оплот', icon: 'CircleOff', cost: 2, tempo: 9,
    shield: 2, weaken: 2, rarity: 'Подпись',
    text: '2 щита · ослабляет ближайший вражеский приказ на 2', flavor: 'В пустоте у всех приказов одинаковый вес: никакой.',
  }),
};

export const BASE_DECK = [
  'spark', 'pulse', 'lance', 'surge', 'fracture', 'barrier', 'anchor',
  'well', 'sweep', 'sever', 'loop', 'leech', 'stasis',
];

export const HEROES = [
  {
    id: 'aria', name: 'АРИЯ', role: 'Хранитель исхода', image: 'images/aria.webp',
    color: '#74e4d0', number: '01', difficulty: 'Сбалансированная',
    quote: '«Я не спасаю прошлое. Я возвращаю ему выбор».',
    passive: 'Приказы со щитом дают дополнительно +1 щит.',
    passiveShort: 'Усиленные заслоны',
    lore: 'Последний архивариус Вэя. Слышит голоса удалённых версий города и отказывается признать хотя бы одну из них лишней.',
    signature: ['sanctuary', 'restoration'],
    stats: { Натиск: 2, Контроль: 4, Хитрость: 2 },
  },
  {
    id: 'vector', name: 'ВЕКТОР', role: 'Автор развязки', image: 'images/vector.webp',
    color: '#ff806c', number: '02', difficulty: 'Агрессивная',
    quote: '«Любая эпоха кончается. Я лишь ставлю точку».',
    passive: 'Захват эпохи наносит дополнительно 2 урона.',
    passiveShort: 'Разрушительный захват',
    lore: 'Бывший инженер Пределной башни. Уверен, что бесконечная секунда — не чудо, а ошибка, которую нужно исправить навсегда.',
    signature: ['execution', 'overclock'],
    stats: { Натиск: 5, Контроль: 2, Хитрость: 3 },
  },
  {
    id: 'mirra', name: 'МИРРА', role: 'Ткач возможностей', image: 'images/mirra.webp',
    color: '#b9a0ff', number: '03', difficulty: 'Комбинационная',
    quote: '«Ты видишь последствие. Я вижу его ветви».',
    passive: 'Ваши Эхи дополнительно сдвигают эпоху на 1.',
    passiveShort: 'Ветвящиеся Эхи',
    lore: 'Родилась в версии Вэя, которой никогда не было. Плетёт карту из чужих решений и всегда оставляет себе второй путь.',
    signature: ['fork', 'mirror'],
    stats: { Натиск: 2, Контроль: 4, Хитрость: 5 },
  },
  {
    id: 'null', name: 'НУЛЬ', role: 'Ненаписанный', image: 'images/null.webp',
    color: '#ead9ad', number: '04', difficulty: 'Непредсказуемая',
    quote: '«Сотри имя — и увидишь, что осталось».',
    passive: 'Каждый четвёртый раунд ваш приказ стоит на 1 заряд меньше.',
    passiveShort: 'Чистый лист',
    lore: 'Единственный человек без Эха. Никто не помнит его прошлого, а машины архива упорно показывают вместо него пустую страницу.',
    signature: ['inversion', 'nullfield'],
    stats: { Натиск: 3, Контроль: 3, Хитрость: 5 },
  },
];

export const getHero = (id) => HEROES.find((hero) => hero.id === id) || HEROES[0];
export const getDeck = (heroId) => [...BASE_DECK, ...getHero(heroId).signature];

export const DIFFICULTIES = [
  { id: 'reader', name: 'Читатель', level: 'I', description: 'Учит правила вместе с вами. Видит только открытую информацию.' },
  { id: 'analyst', name: 'Аналитик', level: 'II', description: 'Строит вероятностную модель ответа и помнит ваши привычки.' },
  { id: 'oracle', name: 'Оракул', level: 'III', description: 'Просчитывает развилки на два раунда. Без права подглядывать.' },
];

export const RANKS = [
  { min: 0, name: 'НЕОПИСАННЫЙ' },
  { min: 1000, name: 'ЧЕРНОВИК' },
  { min: 1125, name: 'РЕДАКТОР' },
  { min: 1275, name: 'ХРАНИТЕЛЬ' },
  { min: 1450, name: 'АРХИТЕКТОР' },
  { min: 1650, name: 'ПАЛИМПСЕСТ' },
];

export const getRank = (rating = 1000) => [...RANKS].reverse().find((rank) => rating >= rank.min) || RANKS[0];

export const STORY_CHAPTERS = [
  { number: '00', title: 'Город, который дожил до точки', text: 'В 23:59:59 архив Вэя переписал сам себя. Время остановилось, а все возможные версии города стали настоящими одновременно.' },
  { number: '01', title: 'Профессия редактора', text: 'Редакторы умеют входить в застывшую секунду и менять её законы. Но каждый приказ оставляет Эхо — повторение, которое нельзя отменить молчанием.' },
  { number: '02', title: 'Последняя дуэль', text: 'Три эпохи могут существовать вместе лишь до тех пор, пока две из них не выберут одного автора. Ваш оппонент уже сделал первую правку.' },
];
