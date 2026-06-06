const { MessageFlags, ActionRowBuilder } = require('discord.js');
const config = require('../../config');
const { getConfig } = require('../../utils/serverConfig');
const { createSubmissionEmbed } = require('../../utils/embedBuilder');

const { addSubmission } = require('../../utils/persistence');

module.exports = {
    id: 'introModal',
    /**
     * @param {import('discord.js').ModalSubmitInteraction} interaction 
     */
    async execute(interaction) {
        // 1. Defer Update immediately to buy time (ephemeral)
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const name = interaction.fields.getTextInputValue('nameInput');
        const age = interaction.fields.getTextInputValue('ageInput');
        const profession = interaction.fields.getTextInputValue('professionInput');
        const platform = interaction.fields.getTextInputValue('platformInput');
        const game = interaction.fields.getTextInputValue('gameInput');

        // Validation: Age must be numeric and realistic (13-99)
        if (isNaN(age) || age < 13 || age > 99) {
            return interaction.editReply({
                content: '❌ Invalid Age! You must be between 13 and 99 years old.',
            });
        }

        // Auto-Mod: Content Filter
        const { containsProfanity } = require('../../utils/contentFilter');
        const { t } = require('../../utils/lang');
        const guildId = interaction.guild.id;

        if (containsProfanity(name) || containsProfanity(profession) || containsProfanity(platform) || containsProfanity(game)) {
            return interaction.editReply({
                content: t('intro.inappropriate', guildId),
            });
        }

        const submissionData = {
            name,
            age,
            profession,
            platform,
            game
        };

        // IMMEDIATE PERSISTENCE (DRAFT STATE)
        // We save it now so we can retrieve it in the next step (gender select)
        await addSubmission(interaction.guild.id, interaction.user.id, {
            submissionData,
            status: 'draft_gender'
        });

        // Prompt for Gender Selection
        const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');

        const select = new StringSelectMenuBuilder()
            .setCustomId('gender_select')
            .setPlaceholder('Select your gender')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Male')
                    .setEmoji('👨')
                    .setValue('Male'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Female')
                    .setEmoji('👩')
                    .setValue('Female'),

            );

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.editReply({
            content: `Almost done! Please select your gender: ${interaction.user}`,
            components: [row]
        });
    },
};
