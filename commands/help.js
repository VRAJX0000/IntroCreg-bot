const { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const { t } = require('../utils/lang');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Lists all available commands and how to use them.')
        .setDMPermission(false),
    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const guildId = interaction.guild.id;

            // -- Embeds Generator --
            const getEmbed = (page) => {
                const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setThumbnail(interaction.client.user.displayAvatarURL())
                    .setTimestamp()
                    .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

                if (page === 'home') {
                    embed.setTitle(`👋 Welcome to ${interaction.client.user.username}`);
                    embed.setDescription(`I am your ultimate Introduction Manager!\nSelect a category below to explore commands.`);
                } else if (page === 'admin') {
                    embed.setTitle('⚙️ Admin Commands');
                    embed.setDescription('Commands for server administrators.');
                    embed.addFields(
                        { name: '`/setup`', value: 'Interactive setup wizard.', inline: true },
                        { name: '`/admin reset-intro`', value: 'Reset a user\'s intro.', inline: true },
                        { name: '`/admin edit-intro`', value: 'Edit an intro.', inline: true },
                        { name: '`/admin edit-gender`', value: 'Change intro gender.', inline: true },
                        { name: '`/admin auto-approve`', value: 'Toggle auto-approve.', inline: true }
                    );
                } else if (page === 'commands') {
                    embed.setTitle('👤 Commands');
                    embed.setDescription('Commands available for everyone.');
                    embed.addFields(
                        { name: '`/help`', value: 'Show this menu.', inline: true },
                        { name: '`/profile`', value: 'View a user card.', inline: true },
                        { name: '`/stats`', value: 'View server stats.', inline: true },
                        { name: '`/support`', value: 'Get support links.', inline: true },
                        { name: '`/ping`', value: 'Check bot latency.', inline: true }
                    );
                } else if (page === 'welcome') {
                    embed.setTitle('✨ Welcome System');
                    embed.setDescription('Configure how new members are welcomed.');
                    embed.addFields(
                        { name: '`/welcome set`', value: 'Set the welcome channel.', inline: true },
                        { name: '`/welcome message`', value: 'Set a custom message.', inline: true },
                        { name: '`/welcome test`', value: 'Test the welcome image.', inline: true },
                        { name: '`/welcome off`', value: 'Disable welcomes.', inline: true }
                    );
                    embed.addFields({ name: '📝 Note', value: 'You can use `{user}` and `{server}` placeholders in your message.', inline: false });
                } else if (page === 'tutorial') {
                    embed.setTitle('📖 How to Use');
                    embed.setDescription('Follow these steps to get started with **Intro Creg Bot**:');
                    embed.addFields(
                        { name: '1️⃣ Run Setup', value: 'Use **`/setup`** to let the bot create the necessary Categories, Channels, and Roles automatically.' },
                        { name: '2️⃣ Permissions', value: 'Ensure the bot role is above the created `Intro Creg` role so it can manage permissions.' },
                        { name: '3️⃣ Introduction', value: 'Users can go to the **introductions channel** and click the "Submit" button to fill out the form.' },
                        { name: '4️⃣ Approval', value: 'Moderators (with the Mod Role) can Approve or Deny submissions in the admin channel.' }
                    );
                }
                return embed;
            };

            // -- Buttons --
            const getButtons = (disabled = false) => {
                const row1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('help_home').setLabel('Home').setStyle(ButtonStyle.Secondary).setEmoji('🏠').setDisabled(disabled),
                    new ButtonBuilder().setCustomId('help_admin').setLabel('Admin').setStyle(ButtonStyle.Primary).setEmoji('🛡️').setDisabled(disabled),
                    new ButtonBuilder().setCustomId('help_commands').setLabel('Commands').setStyle(ButtonStyle.Primary).setEmoji('⌨️').setDisabled(disabled)
                );
                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('help_welcome').setLabel('Welcome').setStyle(ButtonStyle.Primary).setEmoji('✨').setDisabled(disabled),
                    new ButtonBuilder().setCustomId('help_tutorial').setLabel('Tutorial').setStyle(ButtonStyle.Primary).setEmoji('📖').setDisabled(disabled)
                );
                const row3 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel('Support Server').setStyle(ButtonStyle.Link).setURL('https://discord.gg/d93ajT8qqU').setEmoji('🔗')
                );
                return [row1, row2, row3];
            };

            await interaction.editReply({
                embeds: [getEmbed('home')],
                components: getButtons()
            });

            const msg = await interaction.fetchReply();

            // -- Collector --
            const collector = msg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'This menu is not for you!', flags: MessageFlags.Ephemeral });
                }

                const id = i.customId;
                let page = 'home';
                if (id === 'help_admin') page = 'admin';
                if (id === 'help_commands') page = 'commands';
                if (id === 'help_welcome') page = 'welcome';
                if (id === 'help_tutorial') page = 'tutorial';

                try {
                    await i.update({ embeds: [getEmbed(page)] });
                } catch (err) {
                    // Ignore "Unknown interaction" or "Already acknowledged" which happen on rapid clicks or timeouts
                    if (err.code !== 10062 && err.code !== 40060) {
                        console.error('Help Menu Update Error:', err);
                    }
                }
            });

            collector.on('end', () => {
                // Optional cleanup
            });

        } catch (error) {
            console.error('Error in help command:', error);
            // If the interaction is already deferred or replied, we use editReply
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: 'An error occurred while displaying the help menu.' }).catch(() => { });
            } else {
                await interaction.reply({ content: 'An error occurred while displaying the help menu.', flags: MessageFlags.Ephemeral }).catch(() => { });
            }
        }
    },
};
