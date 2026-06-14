/**
 * Seed script — добавляет реалистичные фейковые сделки для демонстрации
 * Запуск: node seed.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT'];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function pickRandom(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

// Реалистичные цены
const PRICES = {
  BTCUSDT: 65000,
  ETHUSDT: 3400,
  SOLUSDT: 165,
  BNBUSDT: 590,
  XRPUSDT: 0.52,
  DOGEUSDT: 0.165,
  AVAXUSDT: 38,
  LINKUSDT: 18,
};

const SETUPS = ['breakout', 'retest', 'rejection', 'knife', 'density', 'scalp', 'level', 'trend'];
const COMMENTS_WIN = [
  'Чёткий пробой уровня с объёмом. Вошёл по ретесту.',
  'Отскок от сильного уровня поддержки. Всё по плану.',
  'Видел сжатие, дождался пробоя. Зашёл по рынку.',
  'Уровень держался 3 раза — на 4й вход.',
  'Нож поймал на откате, быстрый скальп.',
];
const COMMENTS_LOSS = [
  'Поспешил с входом, не дождался подтверждения.',
  'Снял стоп... зря. Надо было держать.',
  'Вошёл против тренда, рынок не развернулся.',
  'FOMO — зашёл на хаях без сетапа.',
  'Передержал убыточную позицию.',
];

async function seed() {
  console.log('🌱 Запуск seed...');

  // Найди или создай пользователя
  let user = await prisma.user.findFirst();
  
  if (!user) {
    const hashed = await bcrypt.hash('test123456', 12);
    user = await prisma.user.create({
      data: {
        email: 'trader@test.com',
        password: hashed,
        name: 'Трейдер',
      }
    });
    console.log('✅ Создан тестовый пользователь: trader@test.com / test123456');
  } else {
    console.log(`✅ Используем пользователя: ${user.email}`);
  }

  // Создай дефолтные правила если нет
  const existingRules = await prisma.riskRules.findUnique({ where: { userId: user.id } });
  if (!existingRules) {
    await prisma.riskRules.create({
      data: {
        userId: user.id,
        maxDailyLossPercent: 5,
        maxTradesPerDay: 4,
        maxLeverage: 10,
        requireStopLoss: true,
        maxConsecutiveLosses: 3,
        motivationalMessages: [
          'Дисциплина — это мост между целями и достижениями.',
          'Ты сделал $300 → $11,000. Это возможно. Не теряй голову.',
          'Стоп-лосс — твой лучший друг. Не двигай его.',
          'После большого профита — обязательный перерыв.',
          'Лучшая сделка которую ты не сделал — это та, которую не нужно было делать.',
        ]
      }
    });
  }

  // Удали старые фейковые сделки
  await prisma.tradePoint.deleteMany({ where: { trade: { userId: user.id } } });
  await prisma.trade.deleteMany({ where: { userId: user.id, exchangeTradeId: null } });

  const trades = [];
  const now = new Date();

  // Генерация 45 сделок за последние 30 дней
  for (let i = 0; i < 45; i++) {
    const symbol = pickRandom(SYMBOLS);
    const basePrice = PRICES[symbol];
    const side = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    const leverage = pickRandom([3, 5, 5, 10, 10, 10, 15, 20]);
    
    // 58% winrate (немного выше 50, как у хорошего скальпера)
    const isWin = Math.random() < 0.58;
    
    const entryPrice = basePrice * (1 + randomBetween(-0.02, 0.02));
    const priceMove = basePrice * randomBetween(0.003, 0.018); // 0.3% - 1.8% движение
    
    let exitPrice;
    if (side === 'LONG') {
      exitPrice = isWin ? entryPrice + priceMove : entryPrice - priceMove * 0.6;
    } else {
      exitPrice = isWin ? entryPrice - priceMove : entryPrice + priceMove * 0.6;
    }

    const quantity = randomBetween(0.01, 0.5) * (1000 / entryPrice) * leverage;
    const rawPnl = side === 'LONG'
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity;
    
    const pnl = Math.round(rawPnl * 100) / 100;
    const commission = Math.abs(quantity * entryPrice * 0.0004); // 0.04% fee

    // Случайное время в последние 30 дней
    const daysAgo = randomBetween(0, 30);
    const openTime = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const durationMin = randomBetween(2, 240); // 2 мин - 4 часа
    const closeTime = new Date(openTime.getTime() + durationMin * 60 * 1000);

    const tags = [pickRandom(SETUPS)];
    if (Math.random() > 0.6) tags.push(pickRandom(SETUPS.filter(t => !tags.includes(t))));

    const isAnnotated = Math.random() > 0.3; // 70% разобраны
    const whyEntered = isAnnotated ? pickRandom([...COMMENTS_WIN, ...COMMENTS_LOSS]) : null;
    const whatWentWrong = isAnnotated && !isWin ? pickRandom(COMMENTS_LOSS) : null;
    const whatWentRight = isAnnotated && isWin ? pickRandom(COMMENTS_WIN) : null;

    const stopLossPrice = side === 'LONG'
      ? entryPrice * (1 - randomBetween(0.005, 0.015))
      : entryPrice * (1 + randomBetween(0.005, 0.015));
    
    const takeProfitPrice = side === 'LONG'
      ? entryPrice * (1 + randomBetween(0.01, 0.04))
      : entryPrice * (1 - randomBetween(0.01, 0.04));

    trades.push({
      userId: user.id,
      symbol,
      side,
      type: 'FUTURES',
      entryPrice: Math.round(entryPrice * 100) / 100,
      exitPrice: Math.round(exitPrice * 100) / 100,
      quantity: Math.round(quantity * 1000) / 1000,
      leverage,
      stopLoss: Math.round(stopLossPrice * 100) / 100,
      takeProfit: Math.round(takeProfitPrice * 100) / 100,
      pnl,
      pnlPercent: Math.round((pnl / (entryPrice * quantity / leverage)) * 10000) / 100,
      commission: Math.round(commission * 100) / 100,
      openTime,
      closeTime,
      duration: Math.round(durationMin * 60),
      status: 'closed',
      setupTags: tags,
      whyEntered,
      whatWentWrong,
      whatWentRight,
      notes: null,
      emotionBefore: isAnnotated ? randomInt(4, 9) : null,
      emotionAfter: isAnnotated ? (isWin ? randomInt(6, 10) : randomInt(2, 6)) : null,
      ruleViolations: [],
      isAnnotated,
    });
  }

  // Сортируем по времени
  trades.sort((a, b) => a.openTime.getTime() - b.openTime.getTime());

  // Создаём сделки пачками
  let created = 0;
  for (const tradeData of trades) {
    const trade = await prisma.trade.create({ data: tradeData });

    // Создаём точки входа/выхода для графика
    const points = [
      {
        tradeId: trade.id,
        type: 'entry',
        price: tradeData.entryPrice,
        quantity: tradeData.quantity,
        time: tradeData.openTime,
      },
    ];

    // Иногда добавляем докупку
    if (Math.random() > 0.7) {
      const addTime = new Date(tradeData.openTime.getTime() + randomBetween(1, 30) * 60 * 1000);
      const addPrice = tradeData.entryPrice * (1 + randomBetween(-0.005, 0.005));
      points.push({
        tradeId: trade.id,
        type: 'add',
        price: Math.round(addPrice * 100) / 100,
        quantity: Math.round(tradeData.quantity * 0.3 * 1000) / 1000,
        time: addTime,
      });
    }

    points.push({
      tradeId: trade.id,
      type: 'exit',
      price: tradeData.exitPrice,
      quantity: tradeData.quantity,
      time: tradeData.closeTime,
    });

    await prisma.tradePoint.createMany({ data: points });
    created++;
  }

  // Добавим 1 открытую сделку
  const openSymbol = 'BTCUSDT';
  const openPrice = PRICES[openSymbol] * (1 + randomBetween(-0.01, 0.01));
  await prisma.trade.create({
    data: {
      userId: user.id,
      symbol: openSymbol,
      side: 'LONG',
      type: 'FUTURES',
      entryPrice: Math.round(openPrice * 100) / 100,
      exitPrice: null,
      quantity: 0.023,
      leverage: 10,
      stopLoss: Math.round(openPrice * 0.992 * 100) / 100,
      takeProfit: Math.round(openPrice * 1.025 * 100) / 100,
      pnl: null,
      commission: 0.6,
      openTime: new Date(now.getTime() - 35 * 60 * 1000), // 35 мин назад
      closeTime: null,
      status: 'open',
      setupTags: ['breakout', 'level'],
      whyEntered: 'Пробой ключевого уровня 65k с хорошим объёмом. Жду цель 67k.',
      ruleViolations: [],
      isAnnotated: true,
    }
  });

  // Добавим журнальные записи за последние 7 дней
  for (let d = 0; d < 7; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    date.setHours(0, 0, 0, 0);

    const moods = [7, 8, 5, 9, 6, 7, 8];
    const slept = [true, true, false, true, true, true, false];

    try {
      await prisma.dailyJournal.upsert({
        where: { userId_date: { userId: user.id, date } },
        update: {},
        create: {
          userId: user.id,
          date,
          moodScore: moods[d],
          sleptWell: slept[d],
          pressureToEarn: false,
          shouldTrade: true,
          morningNotes: d === 0 ? 'Смотрю BTC 65k уровень, ETH 3400. Жду пробоя или отскока.' : null,
          eveningNotes: d === 1 ? 'Хороший день. 3 сделки, все по плану. Не перебрал.' : null,
          lessonsLearned: d === 2 ? 'Снял стоп один раз — надо прекратить эту привычку.' : null,
        }
      });
    } catch (e) { /* skip if exists */ }
  }

  console.log(`✅ Создано ${created} сделок + 1 открытая`);
  console.log('✅ Добавлены записи дневника за 7 дней');
  console.log('\n📊 Открой http://localhost:3000/dashboard чтобы посмотреть!');
  
  await prisma.$disconnect();
}

seed().catch(e => {
  console.error('❌ Ошибка:', e);
  prisma.$disconnect();
  process.exit(1);
});
