const { colors } = require("../config.json");
const { EmbedBuilder } = require("discord.js");
//const log = require('./log');

function sendReply(interaction, type, message) {
  let replyEmbed = new EmbedBuilder()
    .setColor(colors[type])
    .setDescription(message)
    .setTimestamp();
  interaction.editReply({ embeds: [replyEmbed] });
}

module.exports = { sendReply };
