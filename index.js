const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");

const fs = require("fs");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = "1572049078655651921";
const GUILD_ID = "1541743590836011109";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const FILE = "./attendance.json";

function loadData() {
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify({ users: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

let data = loadData();

function saveData() {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function getUser(id, name) {
  if (!data.users[id]) {
    data.users[id] = {
      name,
      totalMs: 0,
      activeSince: null,
      sessions: []
    };
  }

  data.users[id].name = name;
  return data.users[id];
}

function formatTime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours} ساعة و ${minutes} دقيقة`;
}

const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("إنشاء لوحة تسجيل الدوام")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("report")
    .setDescription("عرض تقرير ساعات الدوام")
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription("اختر الموظف")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("عرض ترتيب الموظفين حسب ساعات الدوام")
];

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands.map(command => command.toJSON()) }
  );

  console.log("تم تسجيل أوامر البوت بنجاح");
}

client.once("ready", () => {
  console.log(`Bot Online: ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  try {

    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === "setup") {

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: "ليس لديك صلاحية استخدام هذا الأمر.",
            ephemeral: true
          });
        }

        const embed = new EmbedBuilder()
          .setColor("#1687d9")
          .setTitle("نظام دوام النقل")
          .setDescription(
            "أهلاً بك في نظام تسجيل الدوام.\n\n" +
            "🟢 اضغط تسجيل دخول عند بداية عملك.\n" +
            "🔴 اضغط تسجيل خروج عند انتهاء عملك.\n\n" +
            "سيتم احتساب ساعات عملك تلقائياً."
          );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("checkin")
            .setLabel("تسجيل دخول")
            .setEmoji("🟢")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId("checkout")
            .setLabel("تسجيل خروج")
            .setEmoji("🔴")
            .setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({
          embeds: [embed],
          components: [row]
        });
      }

      if (interaction.commandName === "report") {

        const target = interaction.options.getUser("member") || interaction.user;

        if (
          target.id !== interaction.user.id &&
          !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
        ) {
          return interaction.reply({
            content: "لا يمكنك عرض تقرير موظف آخر.",
            ephemeral: true
          });
        }

        const user = getUser(target.id, target.username);
        let total = user.totalMs;

        if (user.activeSince) {
          total += Date.now() - user.activeSince;
        }

        const embed = new EmbedBuilder()
          .setColor("#1687d9")
          .setTitle("تقرير الدوام")
          .addFields(
            { name: "الموظف", value: `<@${target.id}>`, inline: true },
            { name: "إجمالي ساعات العمل", value: formatTime(total), inline: true },
            { name: "عدد أيام التسجيل", value: `${user.sessions.length}`, inline: true },
            {
              name: "حالة الدوام",
              value: user.activeSince ? "🟢 على رأس العمل" : "🔴 خارج الدوام"
            }
          );

        return interaction.reply({ embeds: [embed] });
      }

      if (interaction.commandName === "rank") {

        const ranking = Object.entries(data.users)
          .map(([id, user]) => {
            let total = user.totalMs;
            if (user.activeSince) total += Date.now() - user.activeSince;
            return { id, name: user.name, total };
          })
          .sort((a, b) => b.total - a.total)
          .slice(0, 10);

        const description = ranking.length
          ? ranking.map((u, i) =>
              `**${i + 1}.** <@${u.id}> — ${formatTime(u.total)}`
            ).join("\n")
          : "لا توجد سجلات دوام حتى الآن.";

        const embed = new EmbedBuilder()
          .setColor("#e0a526")
          .setTitle("🏆 ترتيب الموظفين")
          .setDescription(description);

        return interaction.reply({ embeds: [embed] });
      }
    }

    if (interaction.isButton()) {

      const user = getUser(interaction.user.id, interaction.user.username);

      if (interaction.customId === "checkin") {

        if (user.activeSince) {
          return interaction.reply({
            content: "أنت مسجل دخول بالفعل!",
            ephemeral: true
          });
        }

        user.activeSince = Date.now();
        saveData();

        return interaction.reply({
          content: `🟢 تم تسجيل دخولك بنجاح، بالتوفيق يا <@${interaction.user.id}>!`,
          ephemeral: true
        });
      }

      if (interaction.customId === "checkout") {

        if (!user.activeSince) {
          return interaction.reply({
            content: "أنت غير مسجل دخول حالياً!",
            ephemeral: true
          });
        }

        const start = user.activeSince;
        const end = Date.now();
        const duration = end - start;

        user.totalMs += duration;
        user.sessions.push({
          start,
          end,
          duration
        });

        user.activeSince = null;
        saveData();

        return interaction.reply({
          content:
            `🔴 تم تسجيل خروجك بنجاح.\n` +
            `⏱️ مدة دوامك: **${formatTime(duration)}**\n` +
            `📊 إجمالي دوامك: **${formatTime(user.totalMs)}**`,
          ephemeral: true
        });
      }
    }

  } catch (error) {
    console.error(error);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "حدث خطأ، حاول مرة أخرى.",
        ephemeral: true
      });
    }
  }
});

async function start() {
  if (!TOKEN) {
    throw new Error("DISCORD_TOKEN غير موجود في متغيرات الاستضافة");
  }

  await registerCommands();
  await client.login(TOKEN);
}

start().catch(console.error);
