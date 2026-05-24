import { config, validateConfig } from "./config.js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  createGitHubIssue,
  createGitHubIssueComment,
  upsertGitHubFiles,
} from "./github.js";
import { buildProjectFiles, createProjectContext } from "./projectBuilder.js";
import {
  buildAgentTasks,
  parseSprintMessage,
  sprintToIssue,
  sprintToTaskIssues,
  taskSummaryComment,
} from "./sprintParser.js";
import { resolveProjectSlug } from "./projectResolver.js";
import { TelegramBot } from "./telegram.js";

const HELP = `AI Agent Office hazir.

Sprint baslatmak icin su formatta mesaj gonder:

SPRINT BASLAT
Proje adi: KOBI Teklif Takip
Mevcut proje: kobi-teklif-ve-tahsilat-takip
Hedef: Teklifleri hazirlayip takip eden web uygulamasi.
Kullanici tipi: KOBI sahipleri
Ana ozellikler:
1. Musteri kaydi
2. Teklif olusturma
3. Durum takibi
Olmazsa olmazlar:
1. Mobil panel
2. PDF cikti
Teslim kriteri:
- Demo URL
- GitHub PR
Sure: 5 gun
Butce limiti: Dusuk`;

async function writeProjectFilesLocally(files) {
  for (const file of files) {
    const target = join(process.cwd(), file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }
}

function isAllowed(chatId) {
  if (config.allowedChatIds.size === 0) {
    return true;
  }

  return config.allowedChatIds.has(String(chatId));
}

function isSprintMessage(text) {
  return /^sprint\s+(baslat|başlat)/i.test(text.trim());
}

async function handleMessage(bot, message) {
  const chatId = message.chat.id;
  const text = message.text?.trim();

  if (!text) {
    return;
  }

  if (!isAllowed(chatId)) {
    await bot.sendMessage(chatId, "Bu bot icin yetkili chat listesinde degilsin.");
    return;
  }

  if (text === "/start" || text === "/help") {
    await bot.sendMessage(chatId, HELP);
    return;
  }

  if (!isSprintMessage(text)) {
    await bot.sendMessage(chatId, "Sprint baslatmak icin mesajina `SPRINT BASLAT` ile basla.");
    return;
  }

  const { sprint, warnings } = parseSprintMessage(text);
  const resolvedProject = config.dryRun
    ? {
        projectSlug:
          sprint.projectSlug || sprint.existingProject || sprint.projectName,
        matchType: "dry-run",
      }
    : await resolveProjectSlug({
        token: config.githubToken,
        repo: config.githubRepo,
        sprint,
      });
  const context = createProjectContext(sprint, new Date(), resolvedProject.projectSlug);
  const issue = sprintToIssue(sprint, warnings, context);

  if (config.dryRun) {
    await bot.sendMessage(
      chatId,
      `DRY_RUN aktif. GitHub'a yazilmadi.\n\nProje: ${context.projectPath}\nEslesme: ${resolvedProject.matchType}\nBaslik: ${issue.title}\nTask sayisi: ${sprint.features.length + sprint.mustHaves.length + 1}\nUyari sayisi: ${warnings.length}`,
    );
    return;
  }

  const agentTasks = buildAgentTasks(sprint, context);
  const projectFiles = buildProjectFiles(sprint, context, agentTasks);
  await writeProjectFilesLocally(projectFiles);

  await upsertGitHubFiles({
    token: config.githubToken,
    repo: config.githubRepo,
    files: projectFiles,
    message:
      resolvedProject.matchType === "new"
        ? `Create project workspace for ${sprint.projectName}`
        : `Update project workspace for ${sprint.projectName}`,
  });

  const parentIssue = await createGitHubIssue({
    token: config.githubToken,
    repo: config.githubRepo,
    ...issue,
  });

  const taskPayloads = sprintToTaskIssues(sprint, parentIssue, context);
  const taskIssues = [];

  for (const taskPayload of taskPayloads) {
    const taskIssue = await createGitHubIssue({
      token: config.githubToken,
      repo: config.githubRepo,
      ...taskPayload,
    });
    taskIssues.push(taskIssue);
  }

  await createGitHubIssueComment({
    token: config.githubToken,
    repo: config.githubRepo,
    issueNumber: parentIssue.number,
    body: taskSummaryComment(parentIssue, taskIssues, context),
  });

  const taskLinks = taskIssues
    .map((taskIssue) => `#${taskIssue.number} ${taskIssue.title}`)
    .join("\n");

  await bot.sendMessage(
    chatId,
    `Sprint islendi.\n\nProje klasoru:\n${context.projectPath}\nEslesme: ${resolvedProject.matchType}\n\nCalistirma:\ngit pull\ncd ${context.projectPath}\nstart.cmd\n\nTarayici:\nTerminalde yazan localhost adresini ac.\n\nAna sprint:\n${parentIssue.html_url}\n\nTasklar:\n${taskLinks}`,
  );
}

async function handleUpdate(bot, update) {
  if (!update.message) {
    return;
  }

  try {
    await handleMessage(bot, update.message);
  } catch (error) {
    console.error(error);

    const chatId = update.message.chat?.id;
    if (chatId) {
      await bot.sendMessage(
        chatId,
        `Sprint islenirken hata olustu.\n\n${error.message}`,
      );
    }
  }
}

async function main() {
  validateConfig();

  const bot = new TelegramBot({ token: config.telegramBotToken });
  console.log(`AI Agent Office bot started for ${config.githubRepo}`);

  while (true) {
    try {
      const updates = await bot.getUpdates();

      for (const update of updates) {
        await handleUpdate(bot, update);
      }
    } catch (error) {
      console.error(error);
    }

    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
