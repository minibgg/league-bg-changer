#!/usr/bin/env node

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

const COMMUNITY_DRAGON_BASE =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global";

// Ahri Hall of Legends Signature Edition ($500 bundle)
const FAKER_SIGNATURE_AHRI = {
  id: 103087,
  name: "Ahri - Signature Immortalized Legend [Faker]",
  searchNames: [
    "Ahri - Signature Immortalized Legend [Faker]",
    "Ahri Signature",
    "Immortalized Legend Ahri",
    "Faker Ahri",
  ],
};

// Kai'Sa Hall of Legends Signature Edition ($500 bundle)
const UZI_SIGNATURE_KAISA = {
  id: 145071,
  name: "Kai'Sa - Signature Immortalized Legend [Uzi]",
  searchNames: [
    "Kai'Sa - Signature Immortalized Legend [Uzi]",
    "Kai'Sa Signature",
    "Immortalized Legend Kai'Sa",
    "Uzi Kai'Sa",
    "Бессмертная легенда Кай'Са",
    "Кай'Са",
    "Кайса",
  ],
};

async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  return response.json();
}

function addSkin(skinsMap, skin, champions, localizedSkin, localizedChampions) {
  if (!Number.isInteger(skin?.id) || !skin?.name) return;

  const championId = skin.championId ?? Math.floor(skin.id / 1000);
  const champion = champions.get(championId) || "";
  const localizedChampion = localizedChampions.get(championId) || champion;
  const localizedName = localizedSkin?.name || skin.name;
  const makeDisplayName = (championName, skinName) =>
    championName && skinName !== championName
      ? `${championName} - ${skinName}`
      : skinName;

  const name = makeDisplayName(localizedChampion, localizedName);
  const searchNames = [
    name,
    makeDisplayName(champion, skin.name),
    localizedName,
    skin.name,
    localizedChampion,
    champion,
  ].filter(Boolean);

  skinsMap.set(skin.id, { id: skin.id, name, searchNames });
}

function toArray(catalogue) {
  return Array.isArray(catalogue)
    ? catalogue
    : catalogue && typeof catalogue === "object"
      ? Object.values(catalogue)
      : [];
}

async function loadAllGameSkins() {
  const urls = [
    `${COMMUNITY_DRAGON_BASE}/default/v1/champion-summary.json`,
    `${COMMUNITY_DRAGON_BASE}/default/v1/skins.json`,
    `${COMMUNITY_DRAGON_BASE}/ru_ru/v1/champion-summary.json`,
    `${COMMUNITY_DRAGON_BASE}/ru_ru/v1/skins.json`,
  ];
  const [champions, skins, localizedChampions, localizedSkins] =
    await Promise.all(urls.map((url) => getJson(url)));

  const championList = toArray(champions);
  const skinList = toArray(skins);
  if (championList.length === 0 || skinList.length === 0) {
    throw new Error("CommunityDragon returned an unexpected catalogue format.");
  }

  const championNames = new Map(
    championList.map((champion) => [champion.id, champion.name]),
  );
  const localizedChampionNames = new Map(
    toArray(localizedChampions).map((champion) => [champion.id, champion.name]),
  );
  const localizedSkinsById = new Map(
    toArray(localizedSkins).map((skin) => [skin.id, skin]),
  );
  const skinsMap = new Map();

  skinList.forEach((skin) =>
    addSkin(
      skinsMap,
      skin,
      championNames,
      localizedSkinsById.get(skin.id),
      localizedChampionNames,
    ),
  );

  // Хардкод эксклюзивных скинов
  skinsMap.set(FAKER_SIGNATURE_AHRI.id, FAKER_SIGNATURE_AHRI);
  skinsMap.set(UZI_SIGNATURE_KAISA.id, UZI_SIGNATURE_KAISA);

  return Array.from(skinsMap.values());
}

function getLeagueCredentials() {
  return new Promise((resolve, reject) => {
    const { execFile } = require("child_process");

    const args = [
      "-NoProfile",
      "-Command",
      "$client = Get-CimInstance Win32_Process -Filter \"name='LeagueClientUx.exe'\" | Sort-Object CreationDate -Descending | Select-Object -First 1 CommandLine, ExecutablePath; $client | ConvertTo-Json -Compress",
    ];

    execFile("powershell.exe", args, (err, stdout) => {
      if (err) {
        return reject(
          new Error(
            "Не удалось выполнить проверку процессов через PowerShell.",
          ),
        );
      }

      let client = {};
      try {
        client = JSON.parse(stdout);
      } catch {
        client = { CommandLine: stdout };
      }

      try {
        const { readFileSync } = require("fs");
        const { dirname, join } = require("path");
        const lockfile = readFileSync(
          join(dirname(client.ExecutablePath), "lockfile"),
          "utf8",
        )
          .trim()
          .split(":");
        if (lockfile.length >= 5 && /^\d+$/.test(lockfile[2])) {
          return resolve({ port: lockfile[2], token: lockfile[3] });
        }
      } catch {
        // Игнорируем ошибку чтения lockfile
      }

      const commandLine = client.CommandLine || stdout;
      const portMatch = commandLine.match(/--app-port=(\d+)/);
      const tokenMatch = commandLine.match(/--remoting-auth-token=([^\s\"]+)/);

      if (!portMatch || !tokenMatch) {
        return reject(
          new Error("Лига Легенд не запущена или клиент еще загружается."),
        );
      }

      resolve({ port: portMatch[1], token: tokenMatch[1] });
    });
  });
}

async function start() {
  console.log("🔍 Поиск запущенного клиента Лиги Легенд...");
  let credentials;

  try {
    credentials = await getLeagueCredentials();
    console.log(`✅ Клиент найден! (Порт: ${credentials.port})`);
  } catch (err) {
    console.error(`❌ Ошибка: ${err.message}`);
    rl.close();
    return;
  }

  const base64Auth = Buffer.from(`riot:${credentials.token}`).toString(
    "base64",
  );
  const headers = {
    Authorization: `Basic ${base64Auth}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0",
  };

  try {
    const authCheck = await fetch(
      `https://127.0.0.1:${credentials.port}/lol-summoner/v1/current-summoner`,
      { headers },
    );
    if (!authCheck.ok) {
      throw new Error(`LCU returned HTTP ${authCheck.status}`);
    }
  } catch (error) {
    console.error(
      "LCU authorization failed. Restart the tool after the League client is fully loaded:",
      error.message,
    );
    rl.close();
    return;
  }

  console.log("🔄 Загрузка актуальной базы скинов...");

  let skins = [];
  try {
    skins = await loadAllGameSkins();
  } catch (error) {
    console.error("Could not load the complete skin catalogue:", error.message);
  }

  if (skins.length === 0) {
    console.error("❌ Не удалось загрузить базу скинов. Массив пуст.");
    rl.close();
    return;
  }

  console.log(`✅ База обновлена! Всего доступно: ${skins.length} скинов.\n`);

  while (true) {
    const searchInput = await askQuestion(
      "🔍 Введи имя чемпиона/скина на РУС или ENG (или 'exit'): ",
    );

    if (searchInput.toLowerCase() === "exit") {
      console.log("Пока!");
      break;
    }

    const matches = skins.filter(
      (skin) =>
        skin.searchNames?.some((name) =>
          name.toLowerCase().includes(searchInput.toLowerCase()),
        ) || skin.id.toString() === searchInput.trim(),
    );

    if (matches.length === 0) {
      console.log("❌ Ничего не найдено. Попробуй еще раз.\n");
      continue;
    }

    console.log(`\nНайдено вариантов: ${matches.length}`);
    matches.forEach((skin, index) => {
      console.log(`[${index + 1}] ${skin.name} (ID: ${skin.id})`);
    });

    const selection = await askQuestion(
      "\n👉 Введи номер строки или нажмите Enter для отмены: ",
    );
    const selectedIndex = parseInt(selection) - 1;

    if (
      !isNaN(selectedIndex) &&
      selectedIndex >= 0 &&
      selectedIndex < matches.length
    ) {
      const targetSkin = matches[selectedIndex];
      console.log(`\n⏳ Ставим фон: ${targetSkin.name}...`);

      try {
        let finalId = targetSkin.id;

        // Перехват специальных Signature-версий Ahri
        if (
          finalId === 103061 ||
          finalId === 103062 ||
          finalId === 103063 ||
          finalId === 103087
        ) {
          console.log(
            `[DEBUG] Подмена Signature-версии на рабочую Immortalized Ари (103086)`,
          );
          finalId = 103086;
        }

        const response = await fetch(
          `https://127.0.0.1:${credentials.port}/lol-summoner/v1/current-summoner/summoner-profile`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              key: "backgroundSkinId",
              value: finalId,
            }),
          },
        );

        if (response.ok) {
          console.log(
            `\x1b[32m%s\x1b[0m`,
            `✅ Успешно изменен на: ${targetSkin.name} (ID: ${finalId})!`,
          );
          console.log("Переоткрой профиль в игре для обновления.\n");
        } else {
          const details = await response.text();
          if (details) console.error(`LCU response: ${details}`);
          console.error(`❌ Ошибка смены фона. Статус: ${response.status}\n`);
        }
      } catch (err) {
        console.error(`❌ Ошибка запроса: ${err.message}\n`);
      }
    } else {
      console.log("Выбор отменен.\n");
    }
  }

  rl.close();
}

start();
