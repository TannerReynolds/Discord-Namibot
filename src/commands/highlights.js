const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { isStaffCommand } = require("../utils/isStaff.js");
const prisma = require("../utils/prismaClient");
const { colors, emojis, guilds } = require("../config.json");
const { Pagination } = require("@lanred/discordjs-button-embed-pagination");
const { sendReply } = require("../utils/sendReply");
const log = require("../utils/log");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("highlights")
    .setDMPermission(false)
    .setDescription("View your highlights"),
  async execute(interaction) {
    log.debug("begin");
    await interaction.deferReply({ ephemeral: true });
    sendReply(interaction, "main", `${emojis.loading}  Loading Interaction...`);
    let commandChannel = guilds[interaction.guild.id].botCommandsChannelID;
    if (
      !isStaffCommand(
        this.data.name,
        interaction,
        interaction.member,
        PermissionFlagsBits.BanMembers,
      ) &&
      interaction.channel.id !== commandChannel
    )
      return interaction.editReply({
        content: `${emojis.error}  You have to go to the <#${commandChannel}> channel to use this command`,
      });

    let aviURL =
      interaction.user.avatarURL({
        extension: "png",
        forceStatic: false,
        size: 1024,
      }) || interaction.user.defaultAvatarURL;
    let name = interaction.user.username;

    try {
      const highlights = await prisma.highlight.findMany({
        where: {
          userID: interaction.user.id,
          guildId: interaction.guild.id,
        },
      });

      if (!highlights || highlights === undefined) {
        return sendReply(
          interaction,
          "error",
          `${emojis.error}  This user has no highlights.`,
        );
      }

      const formattedHighlights = highlights.map((h) => {
        return [`ID: \`${h.id}\``, `Phrase: \`${h.phrase}\``];
      });

      if (formattedHighlights.length === 0) {
        return sendReply(
          interaction,
          "error",
          `${emojis.error}  This user has no highlights.`,
        );
      }

      const highlightsPerPage = 10;
      const pages = [];
      for (let i = 0; i < formattedHighlights.length; i += highlightsPerPage) {
        const pageHighlights = formattedHighlights.slice(
          i,
          i + highlightsPerPage,
        );
        const embed = new EmbedBuilder()
          .setTitle("Active Highlights")
          .setDescription(
            `${emojis.success}  Showing all highlights for user <@${interaction.user.id}>`,
          )
          .setColor(colors.main)
          .setTimestamp()
          .setAuthor({ name: name, iconURL: aviURL });

        pageHighlights.forEach((h) => {
          if (h[1].length > 1024) {
            h[1] = `${h[1].substring(0, 950)}...\`[REMAINDER OF MESSAGE TOO LONG TO DISPLAY]\``;
          }
          embed.addFields({ name: h[0], value: h[1] });
        });

        pages.push(embed);
      }

      if (pages.length > 1) {
        await new Pagination(interaction, pages, "Page", 600000).paginate();
      } else {
        await interaction.editReply({ embeds: [pages[0]] });
      }
    } catch (error) {
      sendReply(
        interaction,
        "error",
        `${emojis.error}  Error fetching highlights: ${error}`,
      );
      throw error;
    }
    log.debug("end");
  },
};
