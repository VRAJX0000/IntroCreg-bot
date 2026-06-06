const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check the bot\'s latency'),
    async execute(interaction) {
        await interaction.reply({ content: 'Pinging...', flags: MessageFlags.Ephemeral });
        const sent = await interaction.fetchReply();
        const roundTripLatency = sent.createdTimestamp - interaction.createdTimestamp;

        await interaction.editReply({
            content: `🏓 Pong!\n**Latency:** ${roundTripLatency}ms\n**API Latency:** ${Math.round(interaction.client.ws.ping)}ms`
        });
    },
};
