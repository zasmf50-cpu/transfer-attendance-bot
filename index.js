const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField
} = require("discord.js");

const fs = require("fs");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.DISCORD_TOKEN;
const DATA_FILE = "./attendance.json";

let attendance = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))
  : {};

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(attendance, null, 2));
}

client.once("ready", () => {
  console.log(`Bot Online: ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "setup") {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: "ليس لديك صلاحية.", ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle("🚛 نظام دوام النقل")
        .setDescription("اضغط الزر المناسب لتسجيل دوامك.\n\n🟢 تسجيل دخول\n🔴 تسجيل خروج")
        .setColor("Blue");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("checkin")
          .setLabel("تسجيل دخول")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("checkout")
          .setLabel("تسجيل خروج")
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (interaction.commandName === "report") {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: "ليس لديك صلاحية.", ephemeral: true });
      }

      const user = interaction.options.getUser("user");
      const records = attendance[user.id] || [];
      const total = records.reduce((sum, r) => sum + (r.hours || 0), 0);

      return interaction.reply({
        content: `📊 تقرير ${user.username}\nعدد الورديات: ${records.length}\nإجمالي الساعات: ${total.toFixed(2)} ساعة`,
        ephemeral: true
      });
    }
  }

  if (interaction.isButton()) {
    const id = interaction.user.id;
    const now = Date.now();

    if (!attendance[id]) attendance[id] = [];

    if (interaction.customId === "checkin") {
      const active = attendance[id].some(r => !r.end);

      if (active) {
        return interaction.reply({ content: "أنت مسجل دخول بالفعل!", ephemeral: true });
      }

      attendance[id].push({ start: now, end: null, hours: 0 });
      saveData();

      return interaction.reply({
        content: `🟢 تم تسجيل دخولك بنجاح!\nالوقت: <t:${Math.floor(now / 1000)}:F>`,
        ephemeral: true
      });
    }

    if (interaction.customId === "checkout") {
      const record = [...attendance[id]].reverse().find(r => !r.end);

      if (!record) {
        return interaction.reply({ content: "ليس لديك دوام مفتوح!", ephemeral: true });
      }

      record.end = now;
      record.hours = (now - record.start) / 3600000;
      saveData();

      return interaction.reply({
        content: `🔴 تم تسجيل خروجك!\nمدة الدوام: ${record.hours.toFixed(2)} ساعة`,
        ephemeral: true
      });
    }
  }
});

client.login(TOKEN);
