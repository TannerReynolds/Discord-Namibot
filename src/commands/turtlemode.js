const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { isStaffCommand, hasHigherPerms } = require("../utils/isStaff.js");
const prisma = require("../utils/prismaClient");
const { colors, emojis } = require("../config.json");
const { defineTarget } = require("../utils/defineTarget");
const {
  defineDuration,
  defineDurationString,
} = require("../utils/defineDuration");
const {
  durationToString,
  isValidDuration,
  durationToSec,
} = require("../utils/parseDuration");
const { getModChannels } = require("../utils/getModChannels");
//const log = require('../utils/log');
const { sendReply } = require("../utils/sendReply");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("turtlemode")
    .setDMPermission(false)
    .setDescription("Give somebody their own individual slowmode")
    .addStringOption((option) =>
      option
        .setName("user")
        .setDescription("The user to slow down")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Why are you turning them into a turtle")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("interval")
        .setDescription(
          "How often this user is allowed to send a message (Minimum 30s)",
        )
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("duration")
        .setDescription(
          'How long should this slowmode last ("forever" for permanent)',
        )
        .setRequired(true),
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    sendReply(interaction, "main", `${emojis.loading}  Loading Interaction...`);
    if (
      !isStaffCommand(
        this.data.name,
        interaction,
        interaction.member,
        PermissionFlagsBits.ManageMessages,
      )
    )
      return sendReply(
        interaction,
        "error",
        `${emojis.error}  You dont have the necessary permissions to complete this action`,
      );
    let target = await defineTarget(interaction, "edit");
    if (target === undefined) {
      return sendReply(
        interaction,
        "error",
        `${emojis.error}  This user does not exist`,
      );
    }

    let targetMember;

    try {
      targetMember = await interaction.guild.members.fetch(target);
    } catch (error) {
      if (error.message.toLowerCase().includes("unknown member")) {
        targetMember = false;
      } else {
        targetMember = false;
      }
    }
    if (!targetMember)
      return sendReply(
        interaction,
        "error",
        `${emojis.error}  This user is not a guild member`,
      );
    let canDoAction = await hasHigherPerms(interaction.member, targetMember);
    if (!canDoAction) {
      return sendReply(
        interaction,
        "error",
        `${emojis.error}  You or the bot does not have permissions to complete this action`,
      );
    }

    let duration = await defineDuration(interaction);
    let durationString = await defineDurationString(interaction);
    let turtleDate = new Date();

    let interval;
    let intervalString = "30 seconds";
    if (!interaction.options.getString("interval")) {
      interval = 30;
    } else {
      let rawInterval = interaction.options.getString("interval");
      if (await isValidDuration(rawInterval)) {
        interval = await durationToSec(rawInterval);
        intervalString = await durationToString(rawInterval);
        if (interval < 30) interval = 30;
      } else {
        interval = 30;
      }
    }

    let reason = interaction.options.getString("reason")
      ? interaction.options.getString("reason")
      : "no reason provided";

    if (targetMember) {
      await targetMember
        .send(
          `You have been turtleModed in ${interaction.guild.name} for \`${reason}\`. The length of your turtleMode is ${durationString}.`,
        )
        .catch(() => {});
    }

    let aviURL =
      interaction.user.avatarURL({
        extension: "png",
        forceStatic: false,
        size: 1024,
      }) || interaction.user.defaultAvatarURL;
    let name = interaction.user.username;

    let turtleEmbed = new EmbedBuilder()
      .setTitle(`Turned user into a slow little turt`)
      .setColor(colors.success)
      .setDescription(
        `${emojis.success}  Successfully initiated slowmode on <@${target}> at an interval of ${intervalString}, for ${durationString}! Reason: ${reason}`,
      )
      .setTimestamp()
      .setAuthor({ name: name, iconURL: aviURL });

    interaction.channel.send({ embeds: [turtleEmbed] });
    sendReply(
      interaction,
      "success",
      `${emojis.success}  Interaction Complete`,
    );
    if (reason.length > 1024) {
      reason = `${reason.substring(0, 950)}...\`[REMAINDER OF MESSAGE TOO LONG TO DISPLAY]\``;
    }
    let logEmbed = new EmbedBuilder()
      .setColor(colors.main)
      .setTitle("Member Turtlemode Activated")
      .addFields(
        { name: "User", value: `<@${target}> (${target})` },
        { name: "Reason", value: reason },
        { name: "Turtlemode Duration", value: durationString },
        { name: "Moderator", value: `${name} (${interaction.user.id})` },
      )
      .setAuthor({ name: name, iconURL: aviURL })
      .setTimestamp();

    if (targetMember) {
      logEmbed.setThumbnail(
        targetMember.avatarURL({
          extension: "png",
          forceStatic: false,
          size: 1024,
        })
          ? targetMember.avatarURL({
              extension: "png",
              forceStatic: false,
              size: 1024,
            })
          : targetMember.defaultAvatarURL,
      );
    }

    getModChannels(interaction.client, interaction.guild.id).main.send({
      embeds: [logEmbed],
      content: `<@${target}>`,
    });

    if (duration !== "infinite") {
      await prisma.turtleMode.upsert({
        where: {
          userID_guildId: {
            userID: target,
            guildId: interaction.guild.id,
          },
        },
        update: {
          moderator: `${interaction.user.username} (${interaction.user.id})`,
          endDate: duration,
          reason: reason,
          startDate: turtleDate,
          interval: interval,
          duration: durationString,
        },
        create: {
          startDate: turtleDate,
          userID: target,
          guildId: interaction.guild.id,
          moderator: `${interaction.user.username} (${interaction.user.id})`,
          endDate: duration,
          reason: reason,
          interval: interval,
          duration: durationString,
        },
      });
    }
    await prisma.warning.create({
      data: {
        userID: target,
        date: turtleDate,
        guildId: interaction.guild.id,
        reason: reason,
        moderator: `${interaction.user.username} (${interaction.user.id})`,
        type: "SLOWMODE",
      },
    });
  },
};
