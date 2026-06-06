const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('support')
        .setDescription('Get support and official links'),
    async execute(interaction) {
        const { EmbedBuilder } = require('discord.js');
        const { t } = require('../utils/lang');
        const guildId = interaction.guild.id;

        const embed = new EmbedBuilder()
            .setTitle(`🆘 Support & Community`)
            .setDescription(`Need help with **${interaction.client.user.username}**? Join our community!`)
            .setColor(0x5865F2) // Blurple
            .setThumbnail(interaction.client.user.displayAvatarURL());

        embed.addFields(
            { name: '💬 Discord Server', value: '[Join Support Server](https://discord.gg/d93ajT8qqU)', inline: false }
        );

        embed.setFooter({
            text: `Requested by ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL()
        });
        embed.setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
